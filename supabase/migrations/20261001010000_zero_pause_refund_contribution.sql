-- Zero pause refund means no contribution. Keep edits and deletion atomic.
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
    consumed:=CASE WHEN refund=0 THEN 0 ELSE full_price-refund END; delta:=consumed-paused.consumed_amount;
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
  VALUES(p_contract_number,p_billboard_id,b."Billboard_Name",p_pause_date,full_price,rental,full_price,CASE WHEN refund=0 THEN 0 ELSE full_price-refund END,refund,p_manual_refund,
    starts,ends,true,p_notes,price,COALESCE((price->>'basePriceBeforeDiscount')::numeric,full_price),full_price) RETURNING id INTO pause_id;
  ids:=array_remove(ids,p_billboard_id::text);
  SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices FROM jsonb_array_elements(prices) p WHERE COALESCE(p->>'billboardId',p->>'billboard_id')<>p_billboard_id::text;
  UPDATE public."Contract" SET billboard_ids=array_to_string(ids,','),billboards_count=cardinality(ids),billboard_prices=prices::text,
    "Total"=greatest(0,COALESCE("Total",0)-CASE WHEN refund=0 THEN full_price ELSE refund END),"Total Rent"=COALESCE("Total Rent",0)-CASE WHEN refund=0 THEN full_price ELSE refund END,
    "Remaining"=greatest(0,COALESCE("Total",0)-CASE WHEN refund=0 THEN full_price ELSE refund END-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text
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


