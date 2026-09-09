-- Contract edit and pause operations are single transactions and respect existing RLS.
ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS edit_revision bigint NOT NULL DEFAULT 0;
ALTER TABLE public.paused_billboards ADD COLUMN IF NOT EXISTS price_snapshot jsonb;
ALTER TABLE public.paused_billboards ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'paused';
ALTER TABLE public.paused_billboards ADD COLUMN IF NOT EXISTS resumed_at date;
CREATE OR REPLACE FUNCTION public.bump_contract_edit_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.edit_revision := OLD.edit_revision + 1; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS contract_edit_revision ON public."Contract";
CREATE TRIGGER contract_edit_revision BEFORE UPDATE ON public."Contract"
FOR EACH ROW EXECUTE FUNCTION public.bump_contract_edit_revision();

CREATE OR REPLACE FUNCTION public.save_contract_edit_atomic(
  p_contract_number bigint, p_updates jsonb, p_expected_revision bigint, p_task_types jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE;
  old_ids text[]; new_ids text[]; columns_sql text; values_sql text; k text;
  installments jsonb; sibling jsonb; patch jsonb; old_prices jsonb; prices jsonb; row_price jsonb; old_price jsonb;
  paid numeric; total numeric; due numeric; rate numeric; old_contribution numeric; new_contribution numeric;
  friend jsonb; target_task_id uuid; board_id text; item_table text; task_table text; kind text; affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number" = p_contract_number FOR UPDATE;
  IF c.edit_revision <> p_expected_revision THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
  IF jsonb_typeof(p_updates) <> 'object' THEN RAISE EXCEPTION 'INVALID_INPUT'; END IF;
  patch := p_updates - ARRAY['Contract_Number','id','edit_revision','Total Paid','Remaining','created_at','updated_at'];
  prices := COALESCE(patch->'billboard_prices', '[]'::jsonb);
  IF jsonb_typeof(prices) = 'string' THEN prices := (prices #>> '{}')::jsonb; END IF;
  IF jsonb_typeof(prices) <> 'array' THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  old_prices := COALESCE(to_jsonb(c)->'billboard_prices','[]'::jsonb);
  IF jsonb_typeof(old_prices) = 'string' THEN old_prices := COALESCE(NULLIF(old_prices #>> '{}','')::jsonb,'[]'::jsonb); END IF;
  old_ids := regexp_split_to_array(COALESCE(c.billboard_ids,''), '\s*,\s*');
  IF jsonb_typeof(patch->'billboard_ids') = 'array' THEN
    SELECT COALESCE(array_agg(value), ARRAY[]::text[]) INTO new_ids FROM jsonb_array_elements_text(patch->'billboard_ids');
  ELSE new_ids := regexp_split_to_array(COALESCE(patch->>'billboard_ids',''), '\s*,\s*'); END IF;
  new_ids := array_remove(new_ids,'');
  IF EXISTS (SELECT 1 FROM unnest(new_ids) id GROUP BY id HAVING count(*) > 1)
    OR EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE id !~ '^[0-9]+$') THEN RAISE EXCEPTION 'INVALID_BILLBOARD_IDS'; END IF;
  IF cardinality(new_ids) <> jsonb_array_length(prices) THEN RAISE EXCEPTION 'INCOMPLETE_PRICES'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(new_ids) id WHERE
    (SELECT count(*) FROM jsonb_array_elements(prices) p WHERE p->>'billboardId'=id) <> 1) THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  total := (patch->>'Total')::numeric;
  IF total IS NULL OR total < 0 OR total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_TOTAL'; END IF;
  IF (patch->>'End Date')::date < (patch->>'Contract Date')::date THEN RAISE EXCEPTION 'INVALID_DATES'; END IF;
  installments := patch->'installments_data';
  IF jsonb_typeof(installments)='string' THEN installments := (installments #>> '{}')::jsonb; END IF;
  IF installments IS NULL OR jsonb_typeof(installments)<>'array' OR jsonb_array_length(installments)=0 THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(installments) i WHERE
    NULLIF(i->>'amount','') IS NULL OR (i->>'amount')::numeric < 0 OR
    (i->>'amount')::numeric::text IN ('NaN','Infinity','-Infinity') OR
    NULLIF(i->>'dueDate','') IS NULL OR (i->>'dueDate')::date IS NULL) THEN RAISE EXCEPTION 'INVALID_INSTALLMENTS'; END IF;
  SELECT sum((i->>'amount')::numeric) INTO due FROM jsonb_array_elements(installments) i;
  IF round(due,2) <> round(total,2) THEN RAISE EXCEPTION 'INSTALLMENTS_MISMATCH'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(prices) p WHERE
    NULLIF(p->>'finalPrice','') IS NULL OR (p->>'finalPrice')::numeric<0 OR
    (p->>'finalPrice')::numeric::text IN ('NaN','Infinity','-Infinity') OR
    COALESCE(NULLIF(p->>'endDate','')::date,(patch->>'End Date')::date) <
    COALESCE(NULLIF(p->>'startDate','')::date,(patch->>'Contract Date')::date)) THEN RAISE EXCEPTION 'INVALID_PRICES'; END IF;
  -- Lock boards in deterministic order.
  FOR b IN SELECT * FROM public.billboards WHERE "ID"::text = ANY(old_ids || new_ids) ORDER BY "ID" FOR UPDATE LOOP
    IF b.is_partnership THEN
      SELECT value INTO row_price FROM jsonb_array_elements(prices) WHERE value->>'billboardId'=b."ID"::text LIMIT 1;
      SELECT value INTO old_price FROM jsonb_array_elements(old_prices) WHERE value->>'billboardId'=b."ID"::text LIMIT 1;
      SELECT COALESCE(pre_capital_pct,30)/100 INTO rate FROM public.shared_billboards WHERE billboard_id=b."ID" LIMIT 1;
      rate := COALESCE(rate,0.30);
      old_contribution := COALESCE((old_price->>'capitalContribution')::numeric,
        COALESCE((old_price->>'finalPrice')::numeric,(old_price->>'priceAfterDiscount')::numeric,0)*rate);
      new_contribution := COALESCE((row_price->>'finalPrice')::numeric,0)*rate;
      UPDATE public.billboards SET capital_remaining=greatest(0,COALESCE(capital_remaining,capital,0)+old_contribution-new_contribution) WHERE "ID"=b."ID";
      IF row_price IS NOT NULL THEN
        SELECT jsonb_agg(CASE WHEN p->>'billboardId'=b."ID"::text THEN p || jsonb_build_object('capitalContribution',new_contribution) ELSE p END) INTO prices FROM jsonb_array_elements(prices) p;
      END IF;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM public.billboards WHERE "ID"::text=ANY(new_ids)) <> cardinality(new_ids) THEN RAISE EXCEPTION 'MISSING_BILLBOARD'; END IF;
  paid := COALESCE(NULLIF(c."Total Paid"::text,'')::numeric,0);
  patch := patch || jsonb_build_object('billboard_ids',array_to_string(new_ids,','),'billboards_count',cardinality(new_ids),
    'billboard_prices',prices::text,'Remaining',greatest(0,total-paid)::text);
  -- jsonb_populate_record performs the real column-type conversions. Identifiers are quoted,
  -- and only existing writable Contract columns can be updated.
  SELECT string_agg(format('%I',a.attname),','),string_agg(format('r.%I',a.attname),',')
    INTO columns_sql,values_sql FROM pg_attribute a
    WHERE a.attrelid='public."Contract"'::regclass AND a.attnum>0 AND NOT a.attisdropped AND a.attgenerated=''
      AND patch ? a.attname;
  PERFORM set_config('app.contract_edit_installation_removal',COALESCE(p_task_types->>'installation','false'),true);
  EXECUTE format('UPDATE public."Contract" SET (%s)=(SELECT %s FROM jsonb_populate_record(NULL::public."Contract",$1) r) WHERE "Contract_Number"=$2',columns_sql,values_sql) USING to_jsonb(c)||patch,p_contract_number;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.billboards SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح'
    WHERE "Contract_Number"=p_contract_number AND "ID"::text=ANY(old_ids) AND NOT ("ID"::text=ANY(new_ids));
  UPDATE public.billboards target_board SET "Contract_Number"=p_contract_number,"Customer_Name"=patch->>'Customer Name',"Ad_Type"=patch->>'Ad Type',
    "Rent_Start_Date"=COALESCE(NULLIF(p->>'startDate','')::date,(patch->>'Contract Date')::date),
    "Rent_End_Date"=COALESCE(NULLIF(p->>'endDate','')::date,(patch->>'End Date')::date),"Status"='مؤجرة'
    FROM jsonb_array_elements(prices) p WHERE target_board."ID"::text=p->>'billboardId';
  -- Historical completed tasks are retained. Only explicitly selected pending work is removed.
  FOREACH kind IN ARRAY ARRAY['installation','print','cutout','removal'] LOOP
    IF COALESCE((p_task_types->>kind)::boolean,false) THEN
      item_table := kind || '_task_items'; task_table := kind || '_tasks';
      EXECUTE format('DELETE FROM public.%I i USING public.%I t WHERE i.task_id=t.id AND t.contract_id=$1 AND COALESCE(t.status,'''')<>''completed'' AND COALESCE(i.status,'''')<>''completed'' AND i.billboard_id::text=ANY($2) AND NOT (i.billboard_id::text=ANY($3))',item_table,task_table) USING p_contract_number,old_ids,new_ids;
    END IF;
  END LOOP;
  -- Extend existing pending production orders without changing completed history.
  FOR b IN SELECT * FROM public.billboards WHERE "ID"::text=ANY(new_ids) AND NOT ("ID"::text=ANY(old_ids)) LOOP
    SELECT id INTO target_task_id FROM public.print_tasks WHERE contract_id=p_contract_number AND COALESCE(status,'')<>'completed' ORDER BY created_at,id LIMIT 1;
    IF target_task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.print_task_items i WHERE i.task_id=target_task_id AND billboard_id=b."ID") THEN
      SELECT to_jsonb(i) INTO sibling FROM public.print_task_items i JOIN public.billboards other ON other."ID"=i.billboard_id
        WHERE i.task_id=target_task_id AND other."Size"=b."Size" ORDER BY i.id LIMIT 1;
      INSERT INTO public.print_task_items(task_id,billboard_id,status,quantity,faces_count,unit_cost,customer_unit_cost,customer_unit_price,printer_unit_cost,width,height,area,total_cost,customer_total_cost,customer_total_price)
      VALUES(target_task_id,b."ID",'pending',1,COALESCE(b."Faces_Count",1),(sibling->>'unit_cost')::numeric,(sibling->>'customer_unit_cost')::numeric,
        (sibling->>'customer_unit_price')::numeric,(sibling->>'printer_unit_cost')::numeric,(sibling->>'width')::numeric,(sibling->>'height')::numeric,(sibling->>'area')::numeric,
        COALESCE((sibling->>'unit_cost')::numeric,0)*COALESCE((sibling->>'area')::numeric,1),
        COALESCE((sibling->>'customer_unit_cost')::numeric,0)*COALESCE((sibling->>'area')::numeric,1),
        COALESCE((sibling->>'customer_unit_price')::numeric,0)*COALESCE((sibling->>'area')::numeric,1));
    END IF;
    IF b.has_cutout THEN
      SELECT id INTO target_task_id FROM public.cutout_tasks WHERE contract_id=p_contract_number AND COALESCE(status,'')<>'completed' ORDER BY created_at,id LIMIT 1;
      IF target_task_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.cutout_task_items i WHERE i.task_id=target_task_id AND billboard_id=b."ID") THEN
        SELECT to_jsonb(i) INTO sibling FROM public.cutout_task_items i JOIN public.billboards other ON other."ID"=i.billboard_id
          WHERE i.task_id=target_task_id AND other."Size"=b."Size" ORDER BY i.id LIMIT 1;
        INSERT INTO public.cutout_task_items(task_id,billboard_id,status,quantity,unit_cost,total_cost)
          VALUES(target_task_id,b."ID",'pending',1,COALESCE((sibling->>'unit_cost')::numeric,0),COALESCE((sibling->>'unit_cost')::numeric,0));
      END IF;
    END IF;
  END LOOP;
  -- Contract triggers retain responsibility for assigning new installation work to teams.
  DELETE FROM public.friend_billboard_rentals WHERE contract_number=p_contract_number AND NOT (billboard_id::text=ANY(new_ids));
  FOR friend IN SELECT value FROM jsonb_array_elements(COALESCE(NULLIF(p_updates->'friend_rental_data','null'::jsonb),'[]'::jsonb)) LOOP
    IF (friend->>'billboardId')=ANY(new_ids) THEN
      INSERT INTO public.friend_billboard_rentals(contract_number,billboard_id,friend_company_id,friend_rental_cost,customer_rental_price,start_date,end_date)
      SELECT p_contract_number,friend_board."ID",friend_board.friend_company_id,(friend->>'friendRentalCost')::numeric,
        COALESCE((p->>'finalPrice')::numeric,0),(patch->>'Contract Date')::date,(patch->>'End Date')::date
      FROM public.billboards friend_board JOIN jsonb_array_elements(prices) p ON p->>'billboardId'=friend_board."ID"::text
      WHERE friend_board."ID"::text=friend->>'billboardId' AND friend_board.friend_company_id IS NOT NULL
      ON CONFLICT (contract_number,billboard_id) DO UPDATE SET friend_company_id=EXCLUDED.friend_company_id,
        friend_rental_cost=EXCLUDED.friend_rental_cost,customer_rental_price=EXCLUDED.customer_rental_price,start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date;
    END IF;
  END LOOP;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('contract_updated','contract',p_contract_number::text,p_contract_number,'تعديل العقد',
      jsonb_build_object('previousRevision',c.edit_revision,'previousTotal',c."Total",'total',total,'previousBillboardIds',old_ids,'billboardIds',new_ids),auth.uid());
  RETURN (SELECT to_jsonb(x) FROM public."Contract" x WHERE "Contract_Number"=p_contract_number);
END $$;
REVOKE ALL ON FUNCTION public.save_contract_edit_atomic(bigint,jsonb,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_contract_edit_atomic(bigint,jsonb,bigint,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.pause_contract_billboard_atomic(
  p_contract_number bigint, p_billboard_id bigint, p_pause_date date,
  p_notes text DEFAULT '', p_manual_refund numeric DEFAULT NULL, p_expected_revision bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE; prices jsonb; price jsonb;
  ids text[]; starts date; ends date; days integer; elapsed integer;
  full_price numeric; services numeric; rental numeric; refund numeric; pause_id uuid;
  affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=p_contract_number FOR UPDATE;
  IF p_expected_revision IS NOT NULL AND c.edit_revision<>p_expected_revision THEN RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT'; END IF;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=p_billboard_id FOR UPDATE;
  ids := regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*');
  IF NOT (p_billboard_id::text=ANY(ids)) OR b."Contract_Number" IS DISTINCT FROM p_contract_number THEN RAISE EXCEPTION 'BILLBOARD_NOT_IN_CONTRACT'; END IF;
  prices := COALESCE(NULLIF(c.billboard_prices::text,'')::jsonb,'[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=(prices #>> '{}')::jsonb; END IF;
  SELECT p INTO price FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')=p_billboard_id::text LIMIT 1;
  IF price IS NULL THEN RAISE EXCEPTION 'MISSING_SAVED_PRICE'; END IF;
  starts := COALESCE(NULLIF(price->>'startDate','')::date,b."Rent_Start_Date"::date,c."Contract Date"::date);
  ends := COALESCE(NULLIF(price->>'endDate','')::date,b."Rent_End_Date"::date,c."End Date"::date);
  IF p_pause_date IS NULL OR starts IS NULL OR ends IS NULL OR ends<starts OR p_pause_date<starts OR p_pause_date>ends THEN RAISE EXCEPTION 'INVALID_PAUSE_DATE'; END IF;
  full_price := COALESCE((price->>'finalPrice')::numeric,(price->>'priceAfterDiscount')::numeric,(price->>'contractPrice')::numeric);
  IF full_price IS NULL OR full_price<0 THEN RAISE EXCEPTION 'INVALID_SAVED_PRICE'; END IF;
  services := least(full_price,COALESCE((price->>'printCost')::numeric,0)+COALESCE((price->>'installationCost')::numeric,0));
  rental := greatest(0,full_price-services); days:=ends-starts+1; elapsed:=p_pause_date-starts;
  refund:=COALESCE(p_manual_refund,round(rental*(days-elapsed)/days,2));
  IF refund<0 OR refund>rental OR refund::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_REFUND'; END IF;
  INSERT INTO public.paused_billboards(contract_number,billboard_id,billboard_name,pause_date,original_price,net_rent,full_price,
    consumed_amount,refund_amount,manual_refund,original_start_date,original_end_date,deducted_from_contract,notes,price_snapshot,price_before_discount,net_after_discount)
  VALUES(p_contract_number,p_billboard_id,b."Billboard_Name",p_pause_date,full_price,rental,full_price,full_price-refund,refund,p_manual_refund,
    starts,ends,true,p_notes,price,COALESCE((price->>'basePriceBeforeDiscount')::numeric,full_price),full_price) RETURNING id INTO pause_id;
  ids:=array_remove(ids,p_billboard_id::text);
  SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')<>p_billboard_id::text;
  UPDATE public."Contract" SET billboard_ids=array_to_string(ids,','),billboards_count=cardinality(ids),billboard_prices=prices::text,
    "Total"=greatest(0,COALESCE("Total",0)-refund),"Total Rent"=COALESCE("Total Rent",0)-refund,
    "Remaining"=greatest(0,COALESCE("Total",0)-refund-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text
    WHERE "Contract_Number"=p_contract_number;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.billboards SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح',is_visible_in_available=NULL WHERE "ID"=p_billboard_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('billboard_paused','contract',p_contract_number::text,p_contract_number,'إيقاف لوحة من العقد',
      jsonb_build_object('pauseId',pause_id,'billboardId',p_billboard_id,'pauseDate',p_pause_date,'refund',refund,'priceSnapshot',price),auth.uid());
  RETURN jsonb_build_object('success',true,'pauseRefund',refund,'newBillboardIds',to_jsonb(ids),'pauseId',pause_id);
END $$;
REVOKE ALL ON FUNCTION public.pause_contract_billboard_atomic(bigint,bigint,date,text,numeric,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_contract_billboard_atomic(bigint,bigint,date,text,numeric,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_contract_billboard_atomic(p_pause_id uuid,p_resume_date date,p_cancel boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  paused public.paused_billboards%ROWTYPE; c public."Contract"%ROWTYPE; b public.billboards%ROWTYPE;
  cn bigint; prices jsonb; price jsonb; new_price jsonb; ids text[]; amount numeric; days integer; starts date; affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT contract_number INTO STRICT cn FROM public.paused_billboards WHERE id=p_pause_id;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=cn FOR UPDATE;
  SELECT * INTO STRICT paused FROM public.paused_billboards WHERE id=p_pause_id FOR UPDATE;
  SELECT * INTO STRICT b FROM public.billboards WHERE "ID"=paused.billboard_id FOR UPDATE;
  IF paused.lifecycle_state<>'paused' THEN RAISE EXCEPTION 'PAUSE_ALREADY_CLOSED'; END IF;
  IF b."Contract_Number" IS NOT NULL OR b."Status" NOT IN ('متاح','') THEN RAISE EXCEPTION 'BILLBOARD_ALREADY_BOOKED'; END IF;
  IF EXISTS(SELECT 1 FROM public.paused_billboard_replacements WHERE paused_billboard_id=p_pause_id) THEN RAISE EXCEPTION 'REMOVE_REPLACEMENT_FIRST'; END IF;
  IF paused.price_snapshot IS NULL THEN RAISE EXCEPTION 'MISSING_PAUSE_SNAPSHOT: يجب استكمال السعر التاريخي قبل الاستئناف'; END IF;
  price:=paused.price_snapshot;
  IF p_cancel THEN
    starts:=paused.original_start_date; amount:=paused.refund_amount; new_price:=price;
  ELSE
    IF p_resume_date IS NULL OR p_resume_date<=paused.pause_date::date OR p_resume_date>paused.original_end_date::date THEN RAISE EXCEPTION 'INVALID_RESUME_DATE'; END IF;
    starts:=p_resume_date; days:=paused.original_end_date::date-paused.original_start_date::date+1;
    amount:=round(paused.net_rent * (paused.original_end_date::date-p_resume_date+1)/greatest(1,days),2);
    new_price:=jsonb_build_object('billboardId',paused.billboard_id::text,'schemaVersion',2,'currency',price->>'currency',
      'exchangeRate',price->'exchangeRate','basePriceBeforeDiscount',amount,'baseRental',amount,'contractPrice',amount,
      'priceBeforeDiscount',amount,'finalPrice',amount,'priceAfterDiscount',amount,'totalBillboardPrice',amount,
      'discountPerBillboard',0,'printCost',0,'installationCost',0,'startDate',starts,'endDate',paused.original_end_date,
      '_resume_of',p_pause_id,'isContractualAllocation',true);
  END IF;
  ids:=array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'');
  IF paused.billboard_id::text=ANY(ids) THEN RAISE EXCEPTION 'BILLBOARD_ALREADY_IN_CONTRACT'; END IF;
  ids:=array_append(ids,paused.billboard_id::text);
  prices:=COALESCE(NULLIF(c.billboard_prices::text,'')::jsonb,'[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=(prices #>> '{}')::jsonb; END IF;
  UPDATE public."Contract" SET billboard_ids=array_to_string(ids,','),billboards_count=cardinality(ids),billboard_prices=(prices||jsonb_build_array(new_price))::text,
    "Total"=COALESCE("Total",0)+amount,"Total Rent"=COALESCE("Total Rent",0)+amount,
    "Remaining"=greatest(0,COALESCE("Total",0)+amount-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text WHERE "Contract_Number"=cn;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.billboards SET "Contract_Number"=cn,"Customer_Name"=c."Customer Name","Ad_Type"=c."Ad Type",
    "Rent_Start_Date"=starts,"Rent_End_Date"=paused.original_end_date,"Status"='مؤجرة' WHERE "ID"=paused.billboard_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  UPDATE public.paused_billboards SET lifecycle_state=CASE WHEN p_cancel THEN 'cancelled' ELSE 'resumed' END,resumed_at=starts WHERE id=p_pause_id;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES(CASE WHEN p_cancel THEN 'pause_cancelled' ELSE 'billboard_resumed' END,'contract',cn::text,cn,
      CASE WHEN p_cancel THEN 'إلغاء إيقاف خاطئ' ELSE 'استئناف اللوحة مع الاحتفاظ بفترة التوقف' END,
      jsonb_build_object('pauseId',p_pause_id,'resumeDate',starts,'amount',amount,'originalPause',to_jsonb(paused)),auth.uid());
  RETURN jsonb_build_object('contractNumber',cn,'billboardId',paused.billboard_id,'amount',amount);
END $$;
REVOKE ALL ON FUNCTION public.resume_contract_billboard_atomic(uuid,date,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_contract_billboard_atomic(uuid,date,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_paused_billboard_atomic(p_pause_id uuid,p_patch jsonb,p_delete boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  paused public.paused_billboards%ROWTYPE; c public."Contract"%ROWTYPE; cn bigint;
  full_price numeric; refund numeric; consumed numeric; delta numeric; changed_date date; days integer; elapsed integer;
  affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT contract_number INTO STRICT cn FROM public.paused_billboards WHERE id=p_pause_id;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=cn FOR UPDATE;
  SELECT * INTO STRICT paused FROM public.paused_billboards WHERE id=p_pause_id FOR UPDATE;
  IF paused.lifecycle_state<>'paused' OR EXISTS(SELECT 1 FROM public.paused_billboard_replacements WHERE paused_billboard_id=p_pause_id) THEN RAISE EXCEPTION 'PAUSE_HAS_DEPENDENT_OPERATION'; END IF;
  IF p_delete THEN delta:=-paused.consumed_amount;
  ELSE
    changed_date:=COALESCE(NULLIF(p_patch->>'pause_date','')::date,paused.pause_date::date);
    IF changed_date<paused.original_start_date::date OR changed_date>paused.original_end_date::date THEN RAISE EXCEPTION 'INVALID_PAUSE_DATE'; END IF;
    full_price:=COALESCE(paused.full_price,paused.original_price);
    days:=paused.original_end_date::date-paused.original_start_date::date+1;
    elapsed:=changed_date-paused.original_start_date::date;
    refund:=CASE WHEN p_patch ? 'manual_refund' THEN (p_patch->>'manual_refund')::numeric ELSE paused.manual_refund END;
    refund:=COALESCE(refund,round(paused.net_rent*(days-elapsed)/greatest(days,1),2));
    IF refund<0 OR refund>paused.net_rent OR refund::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_REFUND'; END IF;
    consumed:=full_price-refund; delta:=consumed-paused.consumed_amount;
    UPDATE public.paused_billboards SET pause_date=changed_date,refund_amount=refund,consumed_amount=consumed,
      manual_refund=CASE WHEN p_patch ? 'manual_refund' THEN (p_patch->>'manual_refund')::numeric ELSE manual_refund END,
      notes=COALESCE(p_patch->>'notes',notes) WHERE id=p_pause_id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  UPDATE public."Contract" SET "Total"=greatest(0,COALESCE("Total",0)+delta),"Total Rent"=COALESCE("Total Rent",0)+delta,
    "Remaining"=greatest(0,COALESCE("Total",0)+delta-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text WHERE "Contract_Number"=cn;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES(CASE WHEN p_delete THEN 'pause_deleted' ELSE 'pause_updated' END,'contract',cn::text,cn,'تعديل سجل الإيقاف',
      jsonb_build_object('previous',to_jsonb(paused),'changes',p_patch,'delta',delta),auth.uid());
  IF p_delete THEN
    UPDATE public.paused_billboards SET lifecycle_state='cancelled' WHERE id=p_pause_id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  RETURN jsonb_build_object('contractNumber',cn,'billboardId',paused.billboard_id,'delta',delta);
END $$;
REVOKE ALL ON FUNCTION public.edit_paused_billboard_atomic(uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_paused_billboard_atomic(uuid,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_paused_billboard_atomic(p_pause_id uuid,p_replacement_id bigint,p_start date,p_end date,p_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  paused public.paused_billboards%ROWTYPE; c public."Contract"%ROWTYPE; old_repl public.paused_billboard_replacements%ROWTYPE;
  candidate public.billboards%ROWTYPE; cn bigint; ids text[]; prices jsonb; entry jsonb; result_id uuid; delta numeric; affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT contract_number INTO STRICT cn FROM public.paused_billboards WHERE id=p_pause_id;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=cn FOR UPDATE;
  SELECT * INTO STRICT paused FROM public.paused_billboards WHERE id=p_pause_id FOR UPDATE;
  IF paused.lifecycle_state<>'paused' THEN RAISE EXCEPTION 'PAUSE_ALREADY_CLOSED'; END IF;
  SELECT * INTO old_repl FROM public.paused_billboard_replacements WHERE paused_billboard_id=p_pause_id FOR UPDATE;
  PERFORM 1 FROM public.billboards WHERE "ID" IN (old_repl.replacement_billboard_id,p_replacement_id) ORDER BY "ID" FOR UPDATE;
  IF p_replacement_id IS NOT NULL THEN
    IF p_replacement_id=paused.billboard_id OR p_amount IS NULL OR p_amount<0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'INVALID_REPLACEMENT'; END IF;
    IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_start<paused.pause_date::date OR p_end>paused.original_end_date::date THEN RAISE EXCEPTION 'INVALID_REPLACEMENT_DATES'; END IF;
    SELECT * INTO STRICT candidate FROM public.billboards WHERE "ID"=p_replacement_id;
    IF candidate."Contract_Number" IS NOT NULL AND old_repl.replacement_billboard_id IS DISTINCT FROM p_replacement_id THEN RAISE EXCEPTION 'BILLBOARD_ALREADY_BOOKED'; END IF;
    IF candidate."Contract_Number" IS NOT NULL AND candidate."Contract_Number"<>cn THEN RAISE EXCEPTION 'BILLBOARD_ALREADY_BOOKED'; END IF;
  ELSIF old_repl.id IS NULL THEN RAISE EXCEPTION 'REPLACEMENT_NOT_FOUND'; END IF;
  ids:=array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'');
  prices:=COALESCE(NULLIF(c.billboard_prices::text,'')::jsonb,'[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=(prices #>> '{}')::jsonb; END IF;
  IF old_repl.id IS NOT NULL THEN
    ids:=array_remove(ids,old_repl.replacement_billboard_id::text);
    SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices FROM jsonb_array_elements(prices) p WHERE p->>'billboardId'<>old_repl.replacement_billboard_id::text;
    UPDATE public.billboards SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح'
      WHERE "ID"=old_repl.replacement_billboard_id AND "Contract_Number"=cn;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'BILLBOARD_OWNERSHIP_CHANGED'; END IF;
    DELETE FROM public.paused_billboard_replacements WHERE id=old_repl.id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  delta:=COALESCE(p_amount,0)-COALESCE(old_repl.allocated_amount,0);
  IF p_replacement_id IS NOT NULL THEN
    ids:=array_append(ids,p_replacement_id::text);
    INSERT INTO public.paused_billboard_replacements(paused_billboard_id,contract_number,replacement_billboard_id,replacement_billboard_name,start_date,end_date,allocated_amount)
      VALUES(p_pause_id,cn,p_replacement_id,candidate."Billboard_Name",p_start,p_end,p_amount) RETURNING id INTO result_id;
    entry:=jsonb_build_object('billboardId',p_replacement_id::text,'basePriceBeforeDiscount',p_amount,'baseRental',p_amount,'contractPrice',p_amount,
      'priceBeforeDiscount',p_amount,'finalPrice',p_amount,'priceAfterDiscount',p_amount,'totalBillboardPrice',p_amount,'discountPerBillboard',0,
      'installationCost',0,'printCost',0,'startDate',p_start,'endDate',p_end,'isContractualAllocation',true,'_replacement_of',p_pause_id);
    prices:=prices||jsonb_build_array(entry);
    UPDATE public.billboards SET "Contract_Number"=cn,"Customer_Name"=c."Customer Name","Ad_Type"=c."Ad Type","Rent_Start_Date"=p_start,"Rent_End_Date"=p_end,"Status"='مؤجرة'
      WHERE "ID"=p_replacement_id;
    GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;
  UPDATE public."Contract" SET billboard_ids=array_to_string(ids,','),billboard_prices=prices::text,billboards_count=cardinality(ids),
    "Total"=greatest(0,COALESCE("Total",0)+delta),"Total Rent"=COALESCE("Total Rent",0)+delta,
    "Remaining"=greatest(0,COALESCE("Total",0)+delta-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text WHERE "Contract_Number"=cn;
  GET DIAGNOSTICS affected=ROW_COUNT; IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
    VALUES('paused_replacement_changed','contract',cn::text,cn,'تعديل بديل اللوحة الموقوفة',jsonb_build_object('pauseId',p_pause_id,'previous',to_jsonb(old_repl),'new',entry,'delta',delta),auth.uid());
  RETURN jsonb_build_object('id',result_id,'contractNumber',cn,'billboardId',p_replacement_id,'delta',delta);
END $$;
REVOKE ALL ON FUNCTION public.replace_paused_billboard_atomic(uuid,bigint,date,date,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_paused_billboard_atomic(uuid,bigint,date,date,numeric) TO authenticated;

-- Retain the established team assignment rules and honour explicit task-removal choices.
-- Update auto_create_installation_tasks trigger function to prevent deleting completed installation items when billboards are paused/removed from contract.

CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  billboard_id_array int[];
  bb RECORD;
  best_team_id uuid;
  task_id_var uuid;
BEGIN
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(trim(val)::int)
  INTO billboard_id_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS val
  WHERE trim(val) ~ '^\d+$';

  IF billboard_id_array IS NULL OR array_length(billboard_id_array, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
    DECLARE
      old_ids int[];
      removed_ids int[];
    BEGIN
      IF OLD.billboard_ids IS NOT NULL AND OLD.billboard_ids != '' THEN
        SELECT array_agg(trim(val)::int)
        INTO old_ids
        FROM unnest(string_to_array(OLD.billboard_ids, ',')) AS val
        WHERE trim(val) ~ '^\d+$';
      END IF;

      IF old_ids IS NOT NULL THEN
        SELECT array_agg(oid)
        INTO removed_ids
        FROM unnest(old_ids) AS oid
        WHERE oid != ALL(billboard_id_array);

        IF removed_ids IS NOT NULL AND array_length(removed_ids, 1) > 0 THEN
          DELETE FROM installation_task_items
          WHERE billboard_id = ANY(removed_ids)
            AND task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
            AND status != 'completed'
            AND COALESCE(NULLIF(current_setting('app.contract_edit_installation_removal',true),''),'true')::boolean
            AND NOT EXISTS (SELECT 1 FROM installation_tasks parent_task WHERE parent_task.id=installation_task_items.task_id AND parent_task.status='completed');
        END IF;
      END IF;
    END;

    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
        AND b."ID" NOT IN (
          SELECT iti.billboard_id FROM installation_task_items iti
          JOIN installation_tasks it ON iti.task_id = it.id
          WHERE it.contract_id = NEW."Contract_Number"
        )
    LOOP
      best_team_id := NULL;
      
      -- Step 1: match by friend_company + size + city
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- Step 2: match by size + city (general teams only)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 3: match by size + city (ANY team including company-linked)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 4: match by size only
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 5 (LAST RESORT): pick any team
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF best_team_id IS NOT NULL THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status)
          VALUES (NEW."Contract_Number", best_team_id, 'pending')
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;

    DELETE FROM installation_tasks
    WHERE contract_id = NEW."Contract_Number"
      AND id NOT IN (
        SELECT DISTINCT task_id FROM installation_task_items
        WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number")
      );
  ELSE
    FOR bb IN
      SELECT b."ID", b."Size", b."City", COALESCE(b."Faces_Count", 2) as faces, b.friend_company_id
      FROM billboards b
      WHERE b."ID" = ANY(billboard_id_array)
    LOOP
      best_team_id := NULL;
      
      -- Step 1: match by friend_company + size + city
      IF bb.friend_company_id IS NOT NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND t.friend_company_ids IS NOT NULL
          AND array_length(t.friend_company_ids, 1) > 0
          AND bb.friend_company_id = ANY(t.friend_company_ids)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;
      
      -- Step 2: general teams matching size + city
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
          AND (t.friend_company_ids IS NULL OR array_length(t.friend_company_ids, 1) IS NULL OR array_length(t.friend_company_ids, 1) = 0)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 3: ANY team matching size + city (including company-linked)
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
          AND (array_length(t.cities, 1) IS NULL OR array_length(t.cities, 1) = 0 OR bb."City" = ANY(t.cities))
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 4: size only
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        WHERE array_length(t.sizes, 1) > 0
          AND bb."Size" = ANY(t.sizes)
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      -- Step 5: any team
      IF best_team_id IS NULL THEN
        SELECT t.id INTO best_team_id
        FROM installation_teams t
        ORDER BY t.priority DESC
        LIMIT 1;
      END IF;

      IF best_team_id IS NOT NULL THEN
        SELECT id INTO task_id_var
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = best_team_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF task_id_var IS NULL THEN
          INSERT INTO installation_tasks (contract_id, team_id, status)
          VALUES (NEW."Contract_Number", best_team_id, 'pending')
          RETURNING id INTO task_id_var;
        END IF;

        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install)
        VALUES (task_id_var, bb."ID", 'pending', bb.faces)
        ON CONFLICT (task_id, billboard_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
