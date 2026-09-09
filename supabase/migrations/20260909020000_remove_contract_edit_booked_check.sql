-- Remove BILLBOARD_ALREADY_BOOKED restriction from save_contract_edit_atomic
-- Allows contract editing to reassign / override billboard assignments directly.

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
