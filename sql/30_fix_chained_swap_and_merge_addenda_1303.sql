-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Fix Chained Billboard Swaps, Prevent Duplicate Amendments, and Repair Contract #1303
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Fix replace_paused_billboard_atomic:
--    - Prevent BILLBOARD_OWNERSHIP_CHANGED when old replacement was already released or swapped
--    - Clean up pending installation task items for the old replacement
--    - Correct delta calculation when cancelling vs changing replacement
CREATE OR REPLACE FUNCTION public.replace_paused_billboard_atomic(
  p_pause_id uuid,
  p_replacement_id bigint,
  p_start date,
  p_end date,
  p_amount numeric
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  paused public.paused_billboards%ROWTYPE;
  c public."Contract"%ROWTYPE;
  old_repl public.paused_billboard_replacements%ROWTYPE;
  candidate public.billboards%ROWTYPE;
  cn bigint;
  ids text[];
  prices jsonb;
  entry jsonb;
  result_id uuid;
  delta numeric;
  affected bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  SELECT contract_number INTO STRICT cn FROM public.paused_billboards WHERE id=p_pause_id;
  SELECT * INTO STRICT c FROM public."Contract" WHERE "Contract_Number"=cn FOR UPDATE;
  SELECT * INTO STRICT paused FROM public.paused_billboards WHERE id=p_pause_id FOR UPDATE;
  IF paused.lifecycle_state<>'paused' THEN RAISE EXCEPTION 'PAUSE_ALREADY_CLOSED'; END IF;
  SELECT * INTO old_repl FROM public.paused_billboard_replacements WHERE paused_billboard_id=p_pause_id FOR UPDATE;

  IF old_repl.replacement_billboard_id IS NOT NULL AND p_replacement_id IS NOT NULL THEN
    PERFORM 1 FROM public.billboards WHERE "ID" IN (old_repl.replacement_billboard_id, p_replacement_id) ORDER BY "ID" FOR UPDATE;
  ELSIF old_repl.replacement_billboard_id IS NOT NULL THEN
    PERFORM 1 FROM public.billboards WHERE "ID" = old_repl.replacement_billboard_id FOR UPDATE;
  ELSIF p_replacement_id IS NOT NULL THEN
    PERFORM 1 FROM public.billboards WHERE "ID" = p_replacement_id FOR UPDATE;
  END IF;

  IF p_replacement_id IS NOT NULL THEN
    IF p_replacement_id=paused.billboard_id OR p_amount IS NULL OR p_amount<0 OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN
      RAISE EXCEPTION 'INVALID_REPLACEMENT';
    END IF;
    IF p_start IS NULL OR p_end IS NULL OR p_end<p_start OR p_start<paused.pause_date::date OR p_end>paused.original_end_date::date THEN
      RAISE EXCEPTION 'INVALID_REPLACEMENT_DATES';
    END IF;
    SELECT * INTO STRICT candidate FROM public.billboards WHERE "ID"=p_replacement_id;
    IF candidate."Contract_Number" IS NOT NULL AND old_repl.replacement_billboard_id IS DISTINCT FROM p_replacement_id THEN
      RAISE EXCEPTION 'BILLBOARD_ALREADY_BOOKED';
    END IF;
    IF candidate."Contract_Number" IS NOT NULL AND candidate."Contract_Number"<>cn THEN
      RAISE EXCEPTION 'BILLBOARD_ALREADY_BOOKED';
    END IF;
  ELSIF old_repl.id IS NULL THEN
    RAISE EXCEPTION 'REPLACEMENT_NOT_FOUND';
  END IF;

  ids:=array_remove(regexp_split_to_array(COALESCE(c.billboard_ids,''),'\s*,\s*'),'');
  prices:=COALESCE(NULLIF(c.billboard_prices::text,'')::jsonb,'[]'::jsonb);
  IF jsonb_typeof(prices)='string' THEN prices:=(prices #>> '{}')::jsonb; END IF;

  IF old_repl.id IS NOT NULL THEN
    ids:=array_remove(ids,old_repl.replacement_billboard_id::text);
    SELECT COALESCE(jsonb_agg(p),'[]'::jsonb) INTO prices
      FROM jsonb_array_elements(prices) p
     WHERE p->>'billboardId'<>old_repl.replacement_billboard_id::text
       AND p->>'_replacement_of'<>p_pause_id::text;

    -- Release old replacement billboard safely without failing if already released
    UPDATE public.billboards
       SET "Contract_Number"=NULL,"Customer_Name"=NULL,"Ad_Type"=NULL,"Rent_Start_Date"=NULL,"Rent_End_Date"=NULL,"Status"='متاح'
     WHERE "ID"=old_repl.replacement_billboard_id
       AND ("Contract_Number"=cn OR "Contract_Number" IS NULL);

    -- Clean up pending uncompleted installation/reinstallation tasks for the old replacement
    DELETE FROM public.installation_task_items
     WHERE billboard_id = old_repl.replacement_billboard_id
       AND task_id IN (SELECT id FROM public.installation_tasks WHERE contract_id = cn)
       AND COALESCE(status,'pending') <> 'completed'
       AND installation_date IS NULL AND completed_at IS NULL;

    DELETE FROM public.paused_billboard_replacements WHERE id=old_repl.id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;

  IF p_replacement_id IS NULL THEN
    -- Cancellation of replacement: restore contract total to total without replacement
    delta := -COALESCE(paused.refund_amount, old_repl.allocated_amount, 0);
  ELSE
    delta := COALESCE(p_amount, 0) - COALESCE(old_repl.allocated_amount, 0);
  END IF;

  IF p_replacement_id IS NOT NULL THEN
    ids:=array_append(ids,p_replacement_id::text);
    INSERT INTO public.paused_billboard_replacements(
      paused_billboard_id, contract_number, replacement_billboard_id,
      replacement_billboard_name, start_date, end_date, allocated_amount
    ) VALUES (
      p_pause_id, cn, p_replacement_id, candidate."Billboard_Name",
      p_start, p_end, p_amount
    ) RETURNING id INTO result_id;

    entry:=jsonb_build_object(
      'billboardId', p_replacement_id::text,
      'basePriceBeforeDiscount', p_amount,
      'baseRental', p_amount,
      'contractPrice', p_amount,
      'priceBeforeDiscount', p_amount,
      'finalPrice', p_amount,
      'priceAfterDiscount', p_amount,
      'totalBillboardPrice', p_amount,
      'discountPerBillboard', 0,
      'installationCost', 0,
      'printCost', 0,
      'startDate', p_start,
      'endDate', p_end,
      'isContractualAllocation', true,
      '_replacement_of', p_pause_id
    );
    prices:=prices||jsonb_build_array(entry);

    UPDATE public.billboards
       SET "Contract_Number"=cn,"Customer_Name"=c."Customer Name","Ad_Type"=c."Ad Type",
           "Rent_Start_Date"=p_start,"Rent_End_Date"=p_end,"Status"='مؤجرة'
     WHERE "ID"=p_replacement_id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;
  END IF;

  UPDATE public."Contract"
     SET billboard_ids=array_to_string(ids,','),
         billboard_prices=prices::text,
         billboards_count=cardinality(ids),
         "Total"=greatest(0,COALESCE("Total",0)+delta),
         "Total Rent"=COALESCE("Total Rent",0)+delta,
         "Remaining"=greatest(0,COALESCE("Total",0)+delta-COALESCE(NULLIF("Total Paid"::text,'')::numeric,0))::text
   WHERE "Contract_Number"=cn;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'PERMISSION_DENIED'; END IF;

  INSERT INTO public.activity_log(action,entity_type,entity_id,contract_number,description,details,user_id)
  VALUES(
    'paused_replacement_changed',
    'contract',
    cn::text,
    cn,
    CASE WHEN p_replacement_id IS NULL THEN 'إلغاء بديل اللوحة الموقوفة' ELSE 'تعديل بديل اللوحة الموقوفة' END,
    jsonb_build_object('pauseId',p_pause_id,'previous',to_jsonb(old_repl),'new',entry,'delta',delta),
    auth.uid()
  );

  RETURN jsonb_build_object('id',result_id,'contractNumber',cn,'billboardId',p_replacement_id,'delta',delta);
END $$;

REVOKE ALL ON FUNCTION public.replace_paused_billboard_atomic(uuid,bigint,date,date,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_paused_billboard_atomic(uuid,bigint,date,date,numeric) TO authenticated;

-- 2) Update replace_contract_billboard_lifecycle to update paused_billboard_replacements
--    when an existing replacement billboard is swapped (chained swap A -> B -> C)
CREATE OR REPLACE FUNCTION public.replace_contract_billboard_lifecycle(
  p_contract_number bigint,
  p_original_billboard_id bigint,
  p_replacement_billboard_id bigint,
  p_user_id text DEFAULT NULL,
  p_swap_event_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  result jsonb;
  reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
  pb public.paused_billboards%ROWTYPE;
  carry numeric;
BEGIN
  result := public.replace_contract_billboard_lifecycle_v1(
    p_contract_number, p_original_billboard_id, p_replacement_billboard_id, p_user_id, p_swap_event_id
  );

  -- If original billboard was already a replacement for a paused billboard (chained swap B -> C),
  -- update paused_billboard_replacements to point to C instead of leaving B stuck as a phantom duplicate.
  UPDATE public.paused_billboard_replacements
     SET replacement_billboard_id = p_replacement_billboard_id,
         replacement_billboard_name = (SELECT "Billboard_Name" FROM public.billboards WHERE "ID" = p_replacement_billboard_id),
         notes = COALESCE(reason, notes)
   WHERE contract_number = p_contract_number
     AND replacement_billboard_id = p_original_billboard_id;

  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    SELECT * INTO pb FROM public.paused_billboards WHERE id = (result->>'pause_id')::uuid;
    carry := round(COALESCE(pb.full_price, 0) - COALESCE(pb.refund_amount, 0), 2);

    IF FOUND AND EXISTS (
      SELECT 1
        FROM public."Contract" ct,
             jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
       WHERE ct."Contract_Number" = p_contract_number
         AND p->>'_replacement_of' = pb.id::text
         AND p->>'remainingRental' IS NULL
    ) THEN
      UPDATE public."Contract" ct
         SET billboard_prices = (
           SELECT COALESCE(jsonb_agg(
             CASE WHEN p->>'_replacement_of' = pb.id::text AND p->>'remainingRental' IS NULL
               THEN p || jsonb_build_object(
                 'remainingRental', COALESCE((p->>'finalPrice')::numeric, 0),
                 'consumedCarryover', carry,
                 'carriedFromBillboardId', pb.billboard_id,
                 'finalPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'priceAfterDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'totalBillboardPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'contractPrice', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'baseRental', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'basePriceBeforeDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'priceBeforeDiscount', round(COALESCE((p->>'finalPrice')::numeric, 0) + carry, 2),
                 'pricingNote', 'السعر الكامل للوحة المستبدلة؛ الجزء المستهلك تكلفة إضافية')
               ELSE p END
           ), '[]'::jsonb)::text
           FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
         )
       WHERE ct."Contract_Number" = p_contract_number;

      UPDATE public.paused_billboard_replacements
         SET allocated_amount = round(COALESCE(allocated_amount, 0) + carry, 2)
       WHERE paused_billboard_id = pb.id;
    END IF;
  END IF;

  IF reason IS NULL THEN
    RETURN result;
  END IF;

  UPDATE public.activity_log
     SET details = COALESCE(details, '{}'::jsonb) || jsonb_build_object('reason', reason)
   WHERE action = 'installed_board_swap'
     AND contract_number = p_contract_number
     AND details->>'requestId' = p_swap_event_id;

  UPDATE public.installation_tasks t
     SET task_name = 'ملحق عقد #' || p_contract_number || COALESCE(' — تبديل لوحة: ' || reason, ''),
         task_type = 'reinstallation',
         reinstallation_number = (
           SELECT COALESCE(MAX(x.reinstallation_number), 0) + 1
             FROM public.installation_tasks x
            WHERE x.contract_id = p_contract_number
         )
    FROM public.installation_task_items i
   WHERE i.task_id = t.id
     AND t.contract_id = p_contract_number
     AND i.billboard_id = p_replacement_billboard_id
     AND COALESCE(i.status, '') <> 'completed';

  IF result ? 'pause_id' AND (result->>'pause_id') IS NOT NULL THEN
    UPDATE public.paused_billboards
       SET notes = reason
     WHERE id = (result->>'pause_id')::uuid;
  END IF;

  RETURN result || jsonb_build_object('reason', reason);
END $$;

REVOKE ALL ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_contract_billboard_lifecycle(bigint,bigint,bigint,text,text,text) TO authenticated;

-- 3) Prevent duplicate amendments when contract save and instant swaps run in close succession
CREATE OR REPLACE FUNCTION public.capture_contract_amendment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  old_data jsonb;
  new_data jsonb;
  ids text[];
  latest integer;
  existing public.contract_amendments%ROWTYPE;
  before_doc jsonb;
  after_doc jsonb;
  diff jsonb;
BEGIN
  old_data:=public.contract_version_business_data(to_jsonb(OLD));
  new_data:=public.contract_version_business_data(to_jsonb(NEW));
  IF old_data=new_data THEN RETURN NEW; END IF;

  SELECT max(amendment_number) INTO latest FROM public.contract_amendments WHERE contract_number=NEW."Contract_Number";
  IF latest IS NULL THEN
    ids:=array_remove(regexp_split_to_array(COALESCE(OLD.billboard_ids,''),'\s*,\s*'),'');
    IF cardinality(ids)=0 OR EXISTS(SELECT 1 FROM unnest(ids) id
        WHERE NOT public.contract_board_is_installed(OLD."Contract_Number"::bigint,id::bigint)) THEN
      RETURN NEW;
    END IF;
    before_doc:=public.snapshot_contract_document(to_jsonb(OLD));
    INSERT INTO public.contract_amendments(contract_number,amendment_number,transaction_id,created_by,snapshot,previous_snapshot,total_before,total_after)
      VALUES(OLD."Contract_Number",0,txid_current(),auth.uid(),before_doc,before_doc,COALESCE(OLD."Total",0),COALESCE(OLD."Total",0));
    latest:=0;
  END IF;

  -- Merge amendments within the same transaction OR within 60 seconds (rapid save + swap cycles)
  SELECT * INTO existing FROM public.contract_amendments
   WHERE contract_number=NEW."Contract_Number"
     AND (transaction_id=txid_current() OR created_at >= (now() - INTERVAL '60 seconds'))
     AND amendment_number>0
   ORDER BY amendment_number DESC LIMIT 1;

  before_doc:=COALESCE(existing.previous_snapshot,before_doc,public.snapshot_contract_document(to_jsonb(OLD)));
  old_data:=public.contract_version_business_data(before_doc);
  IF old_data=new_data THEN
    IF existing.id IS NOT NULL THEN DELETE FROM public.contract_amendments WHERE id=existing.id; END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('field',k,'before',old_data->k,'after',new_data->k) ORDER BY k),'[]'::jsonb)
    INTO diff FROM (SELECT jsonb_object_keys(old_data||new_data) k) keys WHERE old_data->k IS DISTINCT FROM new_data->k;
  after_doc:=public.snapshot_contract_document(to_jsonb(NEW));

  IF existing.id IS NULL THEN
    INSERT INTO public.contract_amendments(contract_number,amendment_number,transaction_id,created_by,snapshot,previous_snapshot,changes,total_before,total_after)
      VALUES(NEW."Contract_Number",latest+1,txid_current(),auth.uid(),after_doc,before_doc,diff,COALESCE(OLD."Total",0),COALESCE(NEW."Total",0));
  ELSE
    UPDATE public.contract_amendments
       SET snapshot=after_doc,
           changes=diff,
           total_after=COALESCE(NEW."Total",0)
     WHERE id=existing.id;
  END IF;

  RETURN NEW;
END $$;

-- 4) Data Repair for Contract #1303:
--    - Archive duplicate amendments created during swap attempts, merging the final state into amendment #1
CREATE TABLE IF NOT EXISTS public.contract_amendments_archive
  (LIKE public.contract_amendments INCLUDING DEFAULTS);

DO $$
DECLARE
  max_amend integer;
  last_amend public.contract_amendments%ROWTYPE;
BEGIN
  SELECT max(amendment_number) INTO max_amend
    FROM public.contract_amendments
   WHERE contract_number = 1303;

  IF max_amend IS NOT NULL AND max_amend > 1 THEN
    -- Get the latest amendment state
    SELECT * INTO last_amend
      FROM public.contract_amendments
     WHERE contract_number = 1303
     ORDER BY amendment_number DESC
     LIMIT 1;

    -- Copy all amendments > 1 into archive
    INSERT INTO public.contract_amendments_archive
    SELECT * FROM public.contract_amendments
     WHERE contract_number = 1303 AND amendment_number > 1;

    -- Update amendment #1 with the latest state
    UPDATE public.contract_amendments
       SET snapshot = last_amend.snapshot,
           changes = last_amend.changes,
           total_after = last_amend.total_after
     WHERE contract_number = 1303 AND amendment_number = 1;

    -- Delete duplicates > 1 from active table
    DELETE FROM public.contract_amendments
     WHERE contract_number = 1303 AND amendment_number > 1;
  END IF;
END $$;

--    - Self-heal Contract #1303 billboard assignment if SJ1233 is still duplicated
DO $$
DECLARE
  v_sj_id bigint;
  v_latest_repl_id bigint;
BEGIN
  -- Look for SJ1233 billboard
  SELECT "ID" INTO v_sj_id
    FROM public.billboards
   WHERE "Billboard_Name" ILIKE '%SJ1233%'
      OR "Nearest_Landmark" ILIKE '%الترسانة%'
   LIMIT 1;

  IF v_sj_id IS NOT NULL THEN
    -- Check if another board in contract #1303 has _replacement_of
    SELECT (p->>'billboardId')::bigint INTO v_latest_repl_id
      FROM public."Contract" ct,
           jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
     WHERE ct."Contract_Number" = 1303
       AND p->>'_replacement_of' IS NOT NULL
       AND (p->>'billboardId')::bigint <> v_sj_id
     ORDER BY (p->>'finalPrice')::numeric DESC
     LIMIT 1;

    IF v_latest_repl_id IS NOT NULL THEN
      -- Update paused_billboard_replacements to the real replacement
      UPDATE public.paused_billboard_replacements
         SET replacement_billboard_id = v_latest_repl_id,
             replacement_billboard_name = (SELECT "Billboard_Name" FROM public.billboards WHERE "ID" = v_latest_repl_id)
       WHERE contract_number = 1303
         AND replacement_billboard_id = v_sj_id;

      -- Release SJ1233
      UPDATE public.billboards
         SET "Contract_Number" = NULL,
             "Customer_Name" = NULL,
             "Ad_Type" = NULL,
             "Rent_Start_Date" = NULL,
             "Rent_End_Date" = NULL,
             "Status" = 'متاح'
       WHERE "ID" = v_sj_id
         AND "Contract_Number" = 1303;

      -- Remove SJ1233 from contract 1303 billboard_ids and billboard_prices
      UPDATE public."Contract" ct
         SET billboard_ids = array_to_string(
               array_remove(
                 string_to_array(ct.billboard_ids, ','),
                 v_sj_id::text
               ),
               ','
             ),
             billboard_prices = (
               SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)::text
                 FROM jsonb_array_elements(COALESCE(NULLIF(ct.billboard_prices, '')::jsonb, '[]'::jsonb)) p
                WHERE (p->>'billboardId')::bigint <> v_sj_id
             )
       WHERE ct."Contract_Number" = 1303;
    END IF;
  END IF;
END $$;
