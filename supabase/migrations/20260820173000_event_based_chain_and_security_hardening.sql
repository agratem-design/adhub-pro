-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Event-Based Chain Predecessor Lookup, DB Unique Constraints & Actor Security
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Enforce Global Unique Constraints on composite_tasks (1:1 with installation_tasks & unique task_number)
CREATE UNIQUE INDEX IF NOT EXISTS unique_composite_task_installation_task_id 
ON public.composite_tasks(installation_task_id) 
WHERE (installation_task_id IS NOT NULL);

CREATE UNIQUE INDEX IF NOT EXISTS unique_composite_task_task_number 
ON public.composite_tasks(task_number) 
WHERE (task_number IS NOT NULL);

-- 2. Enhanced RPC with Event-Based Chain Predecessor Lookup & Strict Actor Security
CREATE OR REPLACE FUNCTION public.execute_instant_billboard_swap(
  p_contract_number BIGINT,
  p_original_billboard_id BIGINT,
  p_replacement_billboard_id BIGINT,
  p_user_id TEXT DEFAULT NULL,
  p_swap_event_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_orig_bb RECORD;
  v_repl_bb RECORD;
  v_first_bb RECORD;
  v_second_bb RECORD;
  
  v_raw_ids_str TEXT;
  v_ids_array TEXT[];
  v_clean_ids TEXT[];
  v_item_id TEXT;
  v_found_orig_count INT := 0;
  v_orig_idx INT := -1;
  v_idx INT := 0;
  
  v_prices_json JSONB;
  v_updated_prices_json JSONB := '[]'::JSONB;
  v_price_item JSONB;
  v_price_found BOOLEAN := false;
  v_preserved_price NUMERIC := 0;
  
  v_data_json JSONB;
  v_updated_data_json JSONB := '[]'::JSONB;
  v_data_item JSONB;
  
  v_updated_ids_str TEXT;
  v_user_uuid UUID := NULL;
  v_friend_company_uuid UUID := NULL;

  -- Relational Swap Event Identifier
  v_swap_event_id UUID := NULL;
  v_existing_task RECORD;
  v_predecessor_swap_id UUID := NULL;
  v_predecessor_task_id UUID := NULL;
  v_reinstall_task_id UUID := NULL;
  v_next_reinstall_num INT := 1;
  v_new_reinstall_item_id UUID := NULL;
BEGIN
  -- 1. Input Integrity Checks
  IF p_contract_number IS NULL OR p_contract_number <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'message', 'رقم العقد غير صالح'
    );
  END IF;

  IF p_original_billboard_id IS NULL OR p_original_billboard_id <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'message', 'مُعرّف اللوحة الحالية غير صالح'
    );
  END IF;

  IF p_replacement_billboard_id IS NULL OR p_replacement_billboard_id <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_INPUT',
      'message', 'مُعرّف اللوحة البديلة غير صالح'
    );
  END IF;

  IF p_original_billboard_id = p_replacement_billboard_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SAME_BILLBOARD',
      'message', 'لا يمكن استبدال اللوحة بنفسها'
    );
  END IF;

  -- Resolve swap event UUID
  IF p_swap_event_id IS NOT NULL AND p_swap_event_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_swap_event_id := p_swap_event_id::UUID;
  ELSE
    v_swap_event_id := gen_random_uuid();
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- ACTOR SECURITY: Prevent p_user_id spoofing
  -- ═══════════════════════════════════════════════════════════════════════════
  IF auth.uid() IS NOT NULL THEN
    -- Strictly prioritize authenticated session ID over any client-provided payload
    v_user_uuid := auth.uid();
  ELSIF current_user IN ('service_role', 'postgres') AND p_user_id IS NOT NULL AND p_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- Server-side / backend administrative invocation
    v_user_uuid := p_user_id::UUID;
  ELSE
    v_user_uuid := NULL;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- FAST PATH: IDEMPOTENCY CHECK (Check if this swap event was ALREADY executed)
  -- ═══════════════════════════════════════════════════════════════════════════
  SELECT it.id, it.contract_id, it.status, ct.task_number, iti.billboard_id AS replacement_bb_id
  INTO v_existing_task
  FROM public.installation_tasks it
  LEFT JOIN public.composite_tasks ct ON ct.installation_task_id = it.id
  LEFT JOIN public.installation_task_items iti ON iti.task_id = it.id
  WHERE it.source_swap_id = v_swap_event_id
  LIMIT 1;

  IF v_existing_task IS NOT NULL THEN
    -- Verify Payload Fingerprint consistency
    IF v_existing_task.contract_id = p_contract_number AND v_existing_task.replacement_bb_id = p_replacement_billboard_id THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_processed', true,
        'swap_event_id', v_swap_event_id,
        'contract_number', p_contract_number,
        'original_billboard_id', p_original_billboard_id,
        'replacement_billboard_id', p_replacement_billboard_id,
        'reinstallation_task_id', v_existing_task.id,
        'task_number', v_existing_task.task_number,
        'status', v_existing_task.status
      );
    ELSE
      -- Same Key used for a different payload conflict
      RETURN jsonb_build_object(
        'success', false,
        'code', 'IDEMPOTENCY_KEY_CONFLICT',
        'message', 'معرف عملية التبديل مستخدم بالفعل لعملية أخرى مختلفة'
      );
    END IF;
  END IF;

  -- 2. Deterministic Row Locking (Contract first, then Billboards ordered by ID to prevent deadlocks)
  SELECT * INTO v_contract
  FROM public."Contract"
  WHERE "Contract_Number" = p_contract_number
  FOR UPDATE;

  IF v_contract IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONTRACT_NOT_FOUND',
      'message', 'العقد #' || p_contract_number || ' غير موجود'
    );
  END IF;

  -- Lock billboards in ascending ID order
  SELECT * INTO v_first_bb
  FROM public.billboards
  WHERE "ID" = LEAST(p_original_billboard_id, p_replacement_billboard_id)
  FOR UPDATE;

  SELECT * INTO v_second_bb
  FROM public.billboards
  WHERE "ID" = GREATEST(p_original_billboard_id, p_replacement_billboard_id)
  FOR UPDATE;

  IF p_original_billboard_id < p_replacement_billboard_id THEN
    v_orig_bb := v_first_bb;
    v_repl_bb := v_second_bb;
  ELSE
    v_orig_bb := v_second_bb;
    v_repl_bb := v_first_bb;
  END IF;

  IF v_orig_bb IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'OLD_BILLBOARD_NOT_FOUND',
      'message', 'اللوحة الحالية #' || p_original_billboard_id || ' غير موجودة بقاعدة البيانات'
    );
  END IF;

  IF v_repl_bb IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'NEW_BILLBOARD_NOT_FOUND',
      'message', 'اللوحة البديلة #' || p_replacement_billboard_id || ' غير موجودة بقاعدة البيانات'
    );
  END IF;

  -- 3. Validate Contract billboard_ids Membership
  v_raw_ids_str := COALESCE(v_contract.billboard_ids, '');
  IF v_raw_ids_str = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CONTRACT_EMPTY',
      'message', 'العقد لا يحتوي على أي لوحات مسجلة'
    );
  END IF;

  -- Split CSV and normalize
  v_ids_array := string_to_array(v_raw_ids_str, ',');
  v_clean_ids := ARRAY[]::TEXT[];
  v_idx := 0;

  FOREACH v_item_id IN ARRAY v_ids_array LOOP
    v_idx := v_idx + 1;
    v_item_id := TRIM(v_item_id);
    IF v_item_id != '' THEN
      v_clean_ids := array_append(v_clean_ids, v_item_id);
      IF v_item_id = p_original_billboard_id::TEXT THEN
        v_found_orig_count := v_found_orig_count + 1;
        IF v_orig_idx = -1 THEN
          v_orig_idx := v_idx;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF v_found_orig_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'OLD_BILLBOARD_NOT_IN_CONTRACT',
      'message', 'اللوحة #' || p_original_billboard_id || ' ليست مسجلة ضمن لوحات هذا العقد'
    );
  END IF;

  -- 4. Validate Replacement Billboard Availability
  IF p_replacement_billboard_id::TEXT = ANY(v_clean_ids) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'REPLACEMENT_ALREADY_IN_CONTRACT',
      'message', 'اللوحة البديلة مسجلة بالفعل في هذا العقد'
    );
  END IF;

  IF v_repl_bb."Status" IN ('مؤجر', 'محجوز', 'rented', 'reserved') AND v_repl_bb."Contract_Number" IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CANDIDATE_NOT_AVAILABLE',
      'message', 'اللوحة البديلة غير متاحة حالياً (حالتها: ' || COALESCE(v_repl_bb."Status", 'غير معروف') || ')'
    );
  END IF;

  -- 5. Perform In-Place Replacement in billboard_ids Array (Index Preserved)
  v_clean_ids[v_orig_idx] := p_replacement_billboard_id::TEXT;
  v_updated_ids_str := array_to_string(v_clean_ids, ',');

  -- 6. Synchronize billboard_prices with 100% Financial Preservation
  v_preserved_price := COALESCE(v_orig_bb."Price", 0);

  IF v_contract.billboard_prices IS NOT NULL AND TRIM(v_contract.billboard_prices) != '' THEN
    BEGIN
      v_prices_json := v_contract.billboard_prices::JSONB;
    EXCEPTION WHEN OTHERS THEN
      v_prices_json := '[]'::JSONB;
    END;

    IF jsonb_typeof(v_prices_json) = 'array' THEN
      FOR v_price_item IN SELECT * FROM jsonb_array_elements(v_prices_json) LOOP
        IF (v_price_item->>'billboardId' = p_original_billboard_id::TEXT)
           OR (v_price_item->>'billboard_id' = p_original_billboard_id::TEXT)
           OR (v_price_item->>'id' = p_original_billboard_id::TEXT)
           OR (v_price_item->>'ID' = p_original_billboard_id::TEXT) THEN
          
          v_price_found := true;
          -- Capture agreed slot price
          v_preserved_price := COALESCE(
            (v_price_item->>'contractPrice')::NUMERIC,
            (v_price_item->>'finalPrice')::NUMERIC,
            (v_price_item->>'priceAfterDiscount')::NUMERIC,
            (v_price_item->>'totalBillboardPrice')::NUMERIC,
            v_preserved_price
          );

          -- In-place replace identity only, keep all price numbers identical
          v_price_item := jsonb_set(v_price_item, '{billboardId}', to_jsonb(p_replacement_billboard_id::TEXT));
          IF v_price_item ? 'billboard_id' THEN
            v_price_item := jsonb_set(v_price_item, '{billboard_id}', to_jsonb(p_replacement_billboard_id::TEXT));
          END IF;
          IF v_price_item ? 'id' THEN
            v_price_item := jsonb_set(v_price_item, '{id}', to_jsonb(p_replacement_billboard_id::TEXT));
          END IF;
          IF v_price_item ? 'ID' THEN
            v_price_item := jsonb_set(v_price_item, '{ID}', to_jsonb(p_replacement_billboard_id));
          END IF;
        END IF;

        v_updated_prices_json := v_updated_prices_json || jsonb_build_array(v_price_item);
      END LOOP;
    END IF;
  END IF;

  -- Fallback if no matching item found in billboard_prices array
  IF NOT v_price_found THEN
    v_updated_prices_json := v_updated_prices_json || jsonb_build_array(jsonb_build_object(
      'billboardId', p_replacement_billboard_id::TEXT,
      'basePriceBeforeDiscount', v_preserved_price,
      'priceBeforeDiscount', v_preserved_price,
      'discountPerBillboard', 0,
      'priceAfterDiscount', v_preserved_price,
      'contractPrice', v_preserved_price,
      'finalPrice', v_preserved_price,
      'printCost', 0,
      'installationCost', 0,
      'totalBillboardPrice', v_preserved_price,
      'status', 'active'
    ));
  END IF;

  -- 7. Synchronize billboards_data Snapshot if present
  IF v_contract.billboards_data IS NOT NULL AND TRIM(v_contract.billboards_data) != '' THEN
    BEGIN
      v_data_json := v_contract.billboards_data::JSONB;
    EXCEPTION WHEN OTHERS THEN
      v_data_json := '[]'::JSONB;
    END;

    IF jsonb_typeof(v_data_json) = 'array' THEN
      FOR v_data_item IN SELECT * FROM jsonb_array_elements(v_data_json) LOOP
        IF (v_data_item->>'id' = p_original_billboard_id::TEXT)
           OR (v_data_item->>'ID' = p_original_billboard_id::TEXT) THEN
          
          -- Replace physical billboard metadata, keep contractual slot price
          v_data_item := jsonb_build_object(
            'id', p_replacement_billboard_id::TEXT,
            'ID', p_replacement_billboard_id,
            'name', COALESCE(v_repl_bb."Billboard_Name", '#' || p_replacement_billboard_id),
            'Billboard_Name', COALESCE(v_repl_bb."Billboard_Name", '#' || p_replacement_billboard_id),
            'location', COALESCE(v_repl_bb."Nearest_Landmark", ''),
            'Nearest_Landmark', COALESCE(v_repl_bb."Nearest_Landmark", ''),
            'city', COALESCE(v_repl_bb."City", ''),
            'City', COALESCE(v_repl_bb."City", ''),
            'size', COALESCE(v_repl_bb."Size", ''),
            'Size', COALESCE(v_repl_bb."Size", ''),
            'level', COALESCE(v_repl_bb."Level", ''),
            'Level', COALESCE(v_repl_bb."Level", ''),
            'price', v_preserved_price,
            'Price', v_preserved_price,
            'image', COALESCE(v_repl_bb."Image_URL", ''),
            'Image_URL', COALESCE(v_repl_bb."Image_URL", '')
          );
        END IF;

        v_updated_data_json := v_updated_data_json || jsonb_build_array(v_data_item);
      END LOOP;
    END IF;
  END IF;

  -- 8. Mutate Billboard Statuses
  -- A. Release Old Billboard
  UPDATE public.billboards
  SET "Contract_Number" = NULL,
      "Customer_Name" = NULL,
      "Ad_Type" = NULL,
      "Rent_Start_Date" = NULL,
      "Rent_End_Date" = NULL,
      "Status" = 'متاح'
  WHERE "ID" = p_original_billboard_id;

  -- B. Rent Replacement Billboard
  UPDATE public.billboards
  SET "Contract_Number" = p_contract_number,
      "Customer_Name" = v_contract."Customer Name",
      "Ad_Type" = v_contract."Ad Type",
      "Rent_Start_Date" = v_contract."Contract Date",
      "Rent_End_Date" = v_contract."End Date",
      "Status" = 'مؤجر'
  WHERE "ID" = p_replacement_billboard_id;

  -- 9. Mutate Contract Record (Zero financial delta)
  UPDATE public."Contract"
  SET billboard_ids = v_updated_ids_str,
      billboard_prices = v_updated_prices_json::TEXT,
      billboards_data = CASE WHEN v_updated_data_json != '[]'::JSONB THEN v_updated_data_json::TEXT ELSE billboards_data END,
      billboards_count = array_length(v_clean_ids, 1)
  WHERE "Contract_Number" = p_contract_number;

  -- 10. Handle friend_billboard_rentals safely
  DELETE FROM public.friend_billboard_rentals
  WHERE contract_number = p_contract_number 
    AND billboard_id = p_original_billboard_id
    AND COALESCE(used_as_payment, 0) = 0;

  UPDATE public.friend_billboard_rentals
  SET notes = COALESCE(notes, '') || ' [تم استبدال اللوحة باللوحة #' || p_replacement_billboard_id || ']'
  WHERE contract_number = p_contract_number 
    AND billboard_id = p_original_billboard_id
    AND COALESCE(used_as_payment, 0) > 0;

  IF v_repl_bb.friend_company_id IS NOT NULL AND v_repl_bb.friend_company_id::TEXT ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_friend_company_uuid := v_repl_bb.friend_company_id::UUID;
    INSERT INTO public.friend_billboard_rentals (
      contract_number,
      billboard_id,
      friend_company_id,
      start_date,
      end_date,
      customer_rental_price,
      friend_rental_cost,
      notes
    ) VALUES (
      p_contract_number,
      p_replacement_billboard_id,
      v_friend_company_uuid,
      COALESCE(v_contract."Contract Date", CURRENT_DATE),
      COALESCE(v_contract."End Date", CURRENT_DATE),
      v_preserved_price,
      COALESCE(v_repl_bb."Price", v_preserved_price),
      'تبديل باللوحة #' || p_original_billboard_id
    )
    ON CONFLICT (billboard_id, contract_number) DO UPDATE
    SET friend_company_id = EXCLUDED.friend_company_id,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        customer_rental_price = EXCLUDED.customer_rental_price,
        friend_rental_cost = EXCLUDED.friend_rental_cost;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 11. STRICT EVENT-BASED PREDECESSOR CHAIN LOOKUP & INDEPENDENT TASK ISSUANCE
  -- ═══════════════════════════════════════════════════════════════════════════
  
  -- Step A: Find the EXACT predecessor swap event from activity_log that introduced p_original_billboard_id
  SELECT id INTO v_predecessor_swap_id
  FROM public.activity_log
  WHERE action = 'instant_billboard_swap'
    AND contract_number = p_contract_number
    AND (
      (details->>'replacement_billboard_id')::BIGINT = p_original_billboard_id
      OR (details->>'replacement_billboard_name' = v_orig_bb."Billboard_Name")
    )
  ORDER BY created_at DESC
  LIMIT 1;

  -- Step B: If exact predecessor swap event found, find its pending reinstallation task
  IF v_predecessor_swap_id IS NOT NULL THEN
    SELECT id INTO v_predecessor_task_id
    FROM public.installation_tasks
    WHERE source_swap_id = v_predecessor_swap_id
      AND task_type = 'reinstallation'
      AND status IN ('pending', 'in_progress');

    IF v_predecessor_task_id IS NOT NULL THEN
      UPDATE public.installation_task_items
      SET status = 'cancelled',
          notes = COALESCE(notes, '') || ' [تم استبدال اللوحة مرة أخرى باللوحة ' || COALESCE(v_repl_bb."Billboard_Name", '#' || p_replacement_billboard_id) || ' قبل تنفيذ التركيب]'
      WHERE task_id = v_predecessor_task_id;

      UPDATE public.installation_tasks
      SET status = 'cancelled'
      WHERE id = v_predecessor_task_id;
    END IF;
  END IF;

  -- Step C: Update pending print and cutout items to replacement billboard
  UPDATE public.print_task_items
  SET billboard_id = p_replacement_billboard_id
  WHERE billboard_id = p_original_billboard_id
    AND task_id IN (SELECT id FROM public.print_tasks WHERE contract_id = p_contract_number)
    AND status NOT IN ('completed', 'cancelled', 'canceled', 'مكتمل', 'ملغي');

  UPDATE public.cutout_task_items
  SET billboard_id = p_replacement_billboard_id
  WHERE billboard_id = p_original_billboard_id
    AND task_id IN (SELECT id FROM public.cutout_tasks WHERE contract_id = p_contract_number)
    AND status NOT IN ('completed', 'cancelled', 'canceled', 'مكتمل', 'ملغي');

  -- Step D: Issue ONE NEW INDEPENDENT Reinstallation Task with unique source_swap_id
  SELECT COALESCE(MAX(reinstallation_number), 0) + 1 INTO v_next_reinstall_num
  FROM public.installation_tasks
  WHERE task_type = 'reinstallation' AND contract_id = p_contract_number;

  -- Insert Independent Task with source_swap_id
  -- Note: trigger_auto_create_composite_task automatically assigns the next official sequential task_number
  INSERT INTO public.installation_tasks (
    contract_id,
    task_type,
    reinstallation_number,
    source_swap_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_contract_number,
    'reinstallation',
    v_next_reinstall_num,
    v_swap_event_id,
    'pending',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_reinstall_task_id;

  -- Insert Single Billboard Item for this Swap into installation_task_items
  INSERT INTO public.installation_task_items (
    task_id,
    billboard_id,
    source_swap_id,
    status,
    replacement_status,
    replacement_reason,
    notes,
    customer_installation_cost,
    company_installation_cost,
    created_at
  ) VALUES (
    v_reinstall_task_id,
    p_replacement_billboard_id,
    v_swap_event_id,
    'pending',
    'replacement',
    'بديلة عن ' || COALESCE(v_orig_bb."Billboard_Name", '#' || p_original_billboard_id),
    'بديلة عن ' || COALESCE(v_orig_bb."Billboard_Name", '#' || p_original_billboard_id) || ' في العقد #' || p_contract_number,
    0,
    0,
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_new_reinstall_item_id;

  -- 12. Insert Activity Log with matching swap_event_id
  INSERT INTO public.activity_log (
    id,
    action,
    entity_type,
    entity_id,
    contract_number,
    customer_name,
    ad_type,
    description,
    details,
    user_id
  ) VALUES (
    v_swap_event_id,
    'instant_billboard_swap',
    'contract',
    p_contract_number::TEXT,
    p_contract_number,
    v_contract."Customer Name",
    v_contract."Ad Type",
    'تبديل اللوحة #' || p_original_billboard_id || ' باللوحة #' || p_replacement_billboard_id || ' وإصدار مهمة إعادة تركيب مستقلة مع ثبات إجمالي العقد',
    jsonb_build_object(
      'source_swap_id', v_swap_event_id,
      'contract_number', p_contract_number,
      'original_billboard_id', p_original_billboard_id,
      'replacement_billboard_id', p_replacement_billboard_id,
      'original_billboard_name', v_orig_bb."Billboard_Name",
      'replacement_billboard_name', v_repl_bb."Billboard_Name",
      'preserved_contract_price', v_preserved_price,
      'contract_total', v_contract."Total",
      'reinstallation_task_id', v_reinstall_task_id,
      'swap_type', 'INSTANT_1_TO_1_EQUIVALENT'
    ),
    v_user_uuid
  );

  -- 13. Return Success Result
  RETURN jsonb_build_object(
    'success', true,
    'swap_event_id', v_swap_event_id,
    'contract_number', p_contract_number,
    'original_billboard_id', p_original_billboard_id,
    'replacement_billboard_id', p_replacement_billboard_id,
    'preserved_contract_price', v_preserved_price,
    'contract_total_before', v_contract."Total",
    'contract_total_after', v_contract."Total",
    'reinstallation_task_id', v_reinstall_task_id,
    'new_billboard_ids', v_clean_ids,
    'updated_billboard_prices', v_updated_prices_json
  );
END;
$$;

-- Overload for backwards-compatibility without p_swap_event_id
CREATE OR REPLACE FUNCTION public.execute_instant_billboard_swap(
  p_contract_number BIGINT,
  p_original_billboard_id BIGINT,
  p_replacement_billboard_id BIGINT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.execute_instant_billboard_swap(
    p_contract_number,
    p_original_billboard_id,
    p_replacement_billboard_id,
    p_user_id,
    gen_random_uuid()::TEXT
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.execute_instant_billboard_swap(BIGINT, BIGINT, BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_instant_billboard_swap(BIGINT, BIGINT, BIGINT, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.execute_instant_billboard_swap(BIGINT, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_instant_billboard_swap(BIGINT, BIGINT, BIGINT, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
