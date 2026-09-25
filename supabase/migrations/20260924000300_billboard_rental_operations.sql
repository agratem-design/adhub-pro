-- Per-board dates are persisted in billboard_prices, the availability source of truth.
ALTER TABLE public.event_contract_billboards ADD COLUMN IF NOT EXISTS compensate_original boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.event_original_compensation (
  event_id uuid NOT NULL REFERENCES public.event_contracts(id) ON DELETE RESTRICT,
  billboard_id bigint NOT NULL REFERENCES public.billboards("ID"),
  contract_number bigint NOT NULL REFERENCES public."Contract"("Contract_Number"),
  days integer NOT NULL DEFAULT 0 CHECK (days >= 0),
  PRIMARY KEY(event_id,billboard_id)
);
ALTER TABLE public.event_original_compensation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compensation_admin ON public.event_original_compensation;
CREATE POLICY compensation_admin ON public.event_original_compensation FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.extend_billboard_rental_atomic(
  p_billboard_id bigint, p_contract_number bigint, p_days integer, p_reason text,
  p_type text DEFAULT 'manual', p_notes text DEFAULT '', p_expected_end date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE;
  prices jsonb; price jsonb; old_end date; new_end date; affected integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin'::public.app_role) THEN RAISE EXCEPTION 'لا تملك صلاحية تمديد اللوحات'; END IF;
  IF p_days IS NULL OR p_days=0 OR abs(p_days)>36500 OR NULLIF(trim(p_reason),'') IS NULL
    OR (p_days<0 AND p_type<>'event_adjustment') THEN RAISE EXCEPTION 'مدة التمديد أو السبب غير صحيح'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number FOR UPDATE;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=p_billboard_id FOR UPDATE;
  IF c.billboards_released OR NOT (p_billboard_id::text=ANY(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*')))
    THEN RAISE EXCEPTION 'تغير ارتباط اللوحة بالعقد. أعد تحميل البيانات'; END IF;
  prices:=COALESCE(NULLIF(c.billboard_prices,'')::jsonb,'[]'::jsonb);
  SELECT p INTO price FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')=p_billboard_id::text;
  old_end:=COALESCE(NULLIF(price->>'endDate','')::date,CASE WHEN b."Contract_Number"=p_contract_number THEN b."Rent_End_Date"::date END,c."End Date"::date);
  IF old_end IS NULL THEN RAISE EXCEPTION 'لا يوجد تاريخ انتهاء للوحة'; END IF;
  IF p_expected_end IS NOT NULL AND old_end<>p_expected_end THEN RAISE EXCEPTION 'تغير تاريخ انتهاء اللوحة. أعد تحميل البيانات'; END IF;
  new_end:=old_end+p_days;
  IF new_end<COALESCE(NULLIF(price->>'startDate','')::date,c."Contract Date"::date) THEN RAISE EXCEPTION 'تاريخ الانتهاء غير صحيح'; END IF;
  IF p_days>0 AND EXISTS (
    SELECT 1 FROM public."Contract" other
    LEFT JOIN LATERAL jsonb_array_elements(COALESCE(NULLIF(other.billboard_prices,'')::jsonb,'[]'::jsonb)) op
      ON COALESCE(op->>'billboardId',op->>'billboard_id')=p_billboard_id::text
    WHERE other."Contract_Number"<>p_contract_number AND NOT COALESCE(other.billboards_released,false)
      AND p_billboard_id::text=ANY(regexp_split_to_array(COALESCE(other.billboard_ids,''),'\s*,\s*'))
      AND COALESCE(NULLIF(op->>'startDate','')::date,other."Contract Date"::date)<=new_end
      AND COALESCE(NULLIF(op->>'endDate','')::date,other."End Date"::date)>old_end
  ) THEN RAISE EXCEPTION 'فترة التمديد تتعارض مع عقد آخر للوحة'; END IF;
  IF price IS NULL THEN
    prices:=prices||jsonb_build_array(jsonb_build_object('billboardId',p_billboard_id::text,'startDate',c."Contract Date",'endDate',new_end));
  ELSE
    SELECT jsonb_agg(CASE WHEN COALESCE(p->>'billboardId',p->>'billboard_id')=p_billboard_id::text
      THEN p||jsonb_build_object('endDate',new_end) ELSE p END) INTO prices FROM jsonb_array_elements(prices) p;
  END IF;
  UPDATE public."Contract" SET billboard_prices=prices::text WHERE "Contract_Number"=p_contract_number;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'تعذر تحديث العقد'; END IF;
  UPDATE public.billboards SET "Rent_End_Date"=CASE WHEN "Contract_Number"=p_contract_number THEN new_end ELSE "Rent_End_Date" END WHERE "ID"=p_billboard_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'تعذر تحديث اللوحة'; END IF;
  INSERT INTO public.billboard_extensions(billboard_id,contract_number,extension_days,reason,extension_type,old_end_date,new_end_date,notes,created_by)
    VALUES(p_billboard_id,p_contract_number,p_days,p_reason,p_type,old_end,new_end,p_notes,auth.uid()::text);
  RETURN jsonb_build_object('oldEndDate',old_end,'newEndDate',new_end,'days',p_days);
END $$;
REVOKE ALL ON FUNCTION public.extend_billboard_rental_atomic(bigint,bigint,integer,text,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_billboard_rental_atomic(bigint,bigint,integer,text,text,text,date) TO authenticated;

-- Save the event, reservations and compensation together. Retrying an edit does not add days twice.
CREATE OR REPLACE FUNCTION public.save_event_rental_atomic(p_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.event_contracts%ROWTYPE; row_data jsonb; ledger record; b public.billboards%ROWTYPE;
  starts date; ends date; duration integer; desired integer; cn bigint; affected integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'يلزم تسجيل الدخول'; END IF;
  starts:=(p_payload->>'start_date')::date; ends:=(p_payload->>'end_date')::date;
  IF starts IS NULL OR ends IS NULL OR ends<starts THEN RAISE EXCEPTION 'تواريخ المناسبة غير صحيحة'; END IF;
  duration:=ends-starts+1;
  IF jsonb_typeof(p_payload->'billboards')<>'array' OR jsonb_array_length(p_payload->'billboards')=0 THEN RAISE EXCEPTION 'اختر لوحة واحدة على الأقل'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'billboards') r GROUP BY r->>'billboard_id' HAVING count(*)>1)
    THEN RAISE EXCEPTION 'اللوحة مكررة'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.event_contracts(customer_name,event_name,start_date,end_date) VALUES(p_payload->>'customer_name',p_payload->>'event_name',starts,ends) RETURNING * INTO e;
  ELSE
    SELECT * INTO STRICT e FROM public.event_contracts WHERE id=p_id FOR UPDATE;
  END IF;
  -- All concurrent reservations for the same board serialize on this lock.
  PERFORM 1 FROM public.billboards WHERE "ID"::text IN (SELECT r->>'billboard_id' FROM jsonb_array_elements(p_payload->'billboards') r) ORDER BY "ID" FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.event_billboard_reservations r WHERE r.event_contract_id<>e.id AND r.status='active'
    AND r.start_date<=ends AND r.end_date>=starts AND r.billboard_id IN (SELECT x->>'billboard_id' FROM jsonb_array_elements(p_payload->'billboards') x))
    THEN RAISE EXCEPTION 'إحدى اللوحات محجوزة لمناسبة أخرى في هذه الفترة'; END IF;
  UPDATE public.event_contracts SET customer_id=NULLIF(p_payload->>'customer_id','')::uuid,customer_name=p_payload->>'customer_name',
    event_name=p_payload->>'event_name',event_type=p_payload->>'event_type',start_date=starts,end_date=ends,
    total_amount=(p_payload->>'total_amount')::numeric,discount_amount=COALESCE((p_payload->>'discount_amount')::numeric,0),notes=p_payload->>'notes'
    WHERE id=e.id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'تعذر تحديث المناسبة'; END IF;
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_payload->'billboards') LOOP
    SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=(row_data->>'billboard_id')::bigint;
    IF COALESCE((row_data->>'compensate_original')::boolean,false) AND NOT EXISTS(SELECT 1 FROM public.event_original_compensation WHERE event_id=e.id AND billboard_id=b."ID") THEN
      IF b."Contract_Number" IS NULL OR b."Rent_End_Date"::date<starts OR b."Rent_Start_Date"::date>ends THEN
        RAISE EXCEPTION 'لا يوجد عقد أصلي متداخل مع المناسبة لهذه اللوحة'; END IF;
      INSERT INTO public.event_original_compensation(event_id,billboard_id,contract_number) VALUES(e.id,b."ID",b."Contract_Number");
    END IF;
  END LOOP;
  FOR ledger IN SELECT * FROM public.event_original_compensation WHERE event_id=e.id ORDER BY contract_number,billboard_id FOR UPDATE LOOP
    desired:=0;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'billboards') r WHERE r->>'billboard_id'=ledger.billboard_id::text AND COALESCE((r->>'compensate_original')::boolean,false)) THEN desired:=duration; END IF;
    IF desired<>ledger.days THEN
      PERFORM public.extend_billboard_rental_atomic(ledger.billboard_id,ledger.contract_number,desired-ledger.days,
        'تعويض عقد المناسبة '||e.event_contract_number,'event_adjustment','مدة المناسبة كاملة؛ تعديل تراكمي دون تكرار',NULL);
      UPDATE public.event_original_compensation SET days=desired WHERE event_id=e.id AND billboard_id=ledger.billboard_id;
    END IF;
  END LOOP;
  DELETE FROM public.event_contract_billboards WHERE event_contract_id=e.id;
  DELETE FROM public.event_billboard_reservations WHERE event_contract_id=e.id;
  INSERT INTO public.event_contract_billboards(event_contract_id,billboard_id,billboard_name,daily_price,total_price,compensate_original)
    SELECT e.id,r->>'billboard_id',r->>'billboard_name',(r->>'daily_price')::numeric,(r->>'total_price')::numeric,COALESCE((r->>'compensate_original')::boolean,false)
    FROM jsonb_array_elements(p_payload->'billboards') r;
  INSERT INTO public.event_billboard_reservations(event_contract_id,billboard_id,start_date,end_date,status)
    SELECT e.id,r->>'billboard_id',starts,ends,CASE WHEN e.status='cancelled' THEN 'cancelled' ELSE 'active' END FROM jsonb_array_elements(p_payload->'billboards') r;
  RETURN (SELECT to_jsonb(x) FROM public.event_contracts x WHERE id=e.id);
END $$;
REVOKE ALL ON FUNCTION public.save_event_rental_atomic(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_event_rental_atomic(uuid,jsonb) TO authenticated;

CREATE TABLE IF NOT EXISTS public.contract_original_compensation (
  target_contract bigint NOT NULL REFERENCES public."Contract"("Contract_Number") ON DELETE RESTRICT,
  source_contract bigint NOT NULL REFERENCES public."Contract"("Contract_Number"),
  billboard_id bigint NOT NULL REFERENCES public.billboards("ID"),
  days integer NOT NULL DEFAULT 0,
  PRIMARY KEY(target_contract,billboard_id)
);
ALTER TABLE public.contract_original_compensation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contract_compensation_admin ON public.contract_original_compensation;
CREATE POLICY contract_compensation_admin ON public.contract_original_compensation FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.sync_contract_original_compensation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE prices jsonb; p jsonb; r record; desired integer; starts date; ends date;
BEGIN
  -- Updating an original contract's per-board end date must not recursively compensate it.
  IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  prices:=COALESCE(NULLIF(NEW.billboard_prices,'')::jsonb,'[]'::jsonb);
  FOR p IN SELECT value FROM jsonb_array_elements(prices) LOOP
    IF COALESCE((p->>'compensateOriginal')::boolean,false) AND NULLIF(p->>'originalContractNumber','') IS NOT NULL THEN
      IF (p->>'originalContractNumber')::bigint=NEW."Contract_Number" THEN RAISE EXCEPTION 'لا يمكن تعويض العقد نفسه'; END IF;
      INSERT INTO public.contract_original_compensation(target_contract,source_contract,billboard_id)
        VALUES(NEW."Contract_Number",(p->>'originalContractNumber')::bigint,(p->>'billboardId')::bigint)
        ON CONFLICT(target_contract,billboard_id) DO NOTHING;
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM public.contract_original_compensation WHERE target_contract=NEW."Contract_Number" ORDER BY source_contract,billboard_id FOR UPDATE LOOP
    SELECT value INTO p FROM jsonb_array_elements(prices) WHERE value->>'billboardId'=r.billboard_id::text;
    desired:=0;
    IF COALESCE((p->>'compensateOriginal')::boolean,false) AND NOT COALESCE(NEW.billboards_released,false) THEN
      starts:=COALESCE(NULLIF(p->>'startDate','')::date,NEW."Contract Date"::date);
      ends:=COALESCE(NULLIF(p->>'endDate','')::date,NEW."End Date"::date);
      IF starts IS NULL OR ends IS NULL OR ends<starts THEN RAISE EXCEPTION 'فترة الاستعانة باللوحة غير صحيحة'; END IF;
      desired:=ends-starts+1;
    END IF;
    IF desired<>r.days THEN
      PERFORM public.extend_billboard_rental_atomic(r.billboard_id,r.source_contract,desired-r.days,
        'تعويض الاستعانة باللوحة في العقد '||NEW."Contract_Number",'event_adjustment','تعويض مدة العقد المستعين باللوحة',NULL);
      UPDATE public.contract_original_compensation SET days=desired WHERE target_contract=r.target_contract AND billboard_id=r.billboard_id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_original_rental_compensation ON public."Contract";
CREATE TRIGGER sync_original_rental_compensation AFTER INSERT OR UPDATE OF billboard_prices,"Contract Date","End Date",billboards_released
  ON public."Contract" FOR EACH ROW EXECUTE FUNCTION public.sync_contract_original_compensation();

CREATE OR REPLACE FUNCTION public.quick_billboard_contract_change(
  p_contract_number bigint,p_billboard_id bigint,p_action text,p_amount numeric,p_effective date,
  p_revision bigint,p_compensate boolean DEFAULT false,p_source_contract bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE; prices jsonb; ids text[];
  total numeric; delta numeric; installments jsonb; inst jsonb; remaining_delta numeric; value numeric; idx integer; patch jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'يلزم تسجيل الدخول'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number FOR UPDATE;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=p_billboard_id FOR UPDATE;
  IF c.edit_revision<>p_revision THEN RAISE EXCEPTION 'تغير العقد. أعد فتح النافذة لمراجعة القيم'; END IF;
  IF p_amount IS NULL OR p_amount<0 OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_effective IS NULL
    OR p_action NOT IN ('add','remove') THEN RAISE EXCEPTION 'بيانات العملية غير صحيحة'; END IF;
  ids:=array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'');
  prices:=COALESCE(NULLIF(c.billboard_prices,'')::jsonb,'[]'::jsonb);
  IF p_action='add' THEN
    IF p_billboard_id::text=ANY(ids) THEN RAISE EXCEPTION 'اللوحة موجودة في العقد'; END IF;
    IF p_effective<c."Contract Date"::date OR p_effective>c."End Date"::date THEN RAISE EXCEPTION 'تاريخ الإضافة خارج مدة العقد'; END IF;
    IF b."Contract_Number" IS DISTINCT FROM p_source_contract THEN RAISE EXCEPTION 'تغير العقد المرتبط باللوحة. أعد فتح النافذة'; END IF;
    ids:=array_append(ids,p_billboard_id::text); delta:=round(p_amount,2);
    prices:=prices||jsonb_build_array(jsonb_build_object('billboardId',p_billboard_id::text,'startDate',p_effective,'endDate',c."End Date",
      'finalPrice',delta,'priceAfterDiscount',delta,'priceBeforeDiscount',delta,'baseRental',delta,'netRentalAfterDiscount',delta,
      'compensateOriginal',p_compensate,'originalContractNumber',p_source_contract));
  ELSE
    IF NOT (p_billboard_id::text=ANY(ids)) THEN RAISE EXCEPTION 'اللوحة غير موجودة في العقد'; END IF;
    ids:=array_remove(ids,p_billboard_id::text); delta:=-round(p_amount,2);
    SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices FROM jsonb_array_elements(prices) p
      WHERE COALESCE(p->>'billboardId',p->>'billboard_id')<>p_billboard_id::text;
  END IF;
  total:=COALESCE(c."Total",0)+delta;
  IF total<0 THEN RAISE EXCEPTION 'الخصم أكبر من قيمة العقد'; END IF;
  -- Preserve installment dates and metadata; settle the difference from the last installment backwards.
  installments:=COALESCE(NULLIF(c.installments_data,'')::jsonb,'[]'::jsonb);
  IF jsonb_array_length(installments)=0 THEN installments:=jsonb_build_array(jsonb_build_object('amount',total,'dueDate',c."End Date",'description','قيمة العقد بعد تعديل اللوحة'));
  ELSE
    SELECT total-COALESCE(sum((i->>'amount')::numeric),0) INTO remaining_delta FROM jsonb_array_elements(installments) i;
    idx:=jsonb_array_length(installments)-1;
    IF idx>=0 THEN
      inst:=installments->idx; value:=greatest(0,COALESCE((inst->>'amount')::numeric,0)+remaining_delta);
      installments:=jsonb_set(installments,ARRAY[idx::text,'amount'],to_jsonb(value));
    END IF;
  END IF;
  patch:=jsonb_build_object('billboard_ids',array_to_string(ids,','),'billboard_prices',prices::text,'Total',total,
    'Total Rent',COALESCE(c."Total Rent",0)+delta,'Contract Date',c."Contract Date",'End Date',c."End Date",
    'Customer Name',c."Customer Name",'Ad Type',c."Ad Type",'installments_data',installments::text,
    'friend_rental_data',COALESCE(c.friend_rental_data,'[]'::jsonb));
  PERFORM public.save_contract_edit_atomic(p_contract_number,patch,p_revision,'{}'::jsonb);
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('quick_billboard_change','contract',p_contract_number::text,p_contract_number,'تعديل لوحة من إدارة اللوحات',
      jsonb_build_object('billboardId',p_billboard_id,'action',p_action,'difference',delta,'effectiveDate',p_effective,'previousPrices',c.billboard_prices),auth.uid());
  RETURN jsonb_build_object('total',total,'difference',delta);
END $$;
REVOKE ALL ON FUNCTION public.quick_billboard_contract_change(bigint,bigint,text,numeric,date,bigint,boolean,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quick_billboard_contract_change(bigint,bigint,text,numeric,date,bigint,boolean,bigint) TO authenticated;
