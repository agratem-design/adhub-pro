
-- 1. Fix the 3 remaining billboards that are still showing old contracts
UPDATE billboards 
SET "Status" = 'محجوز', 
    "Contract_Number" = 1189, 
    "Customer_Name" = 'محمد البحباح', 
    "Rent_Start_Date" = '2026-01-18', 
    "Rent_End_Date" = '2026-07-17'
WHERE "ID" IN (29, 74, 266);

-- 2. Improve sync_billboards_from_contract to always check for newest contract
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
 RETURNS json
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  updated_count int := 0;
  row_ct int := 0;
BEGIN
  SELECT "Contract_Number", "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids
    INTO v_contract
    FROM "Contract"
   WHERE "Contract_Number" = p_contract_number;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'contract_not_found');
  END IF;

  IF v_contract.billboard_ids IS NULL OR TRIM(v_contract.billboard_ids) = '' THEN
    RETURN json_build_object('ok', true, 'updated', 0);
  END IF;

  FOR v_billboard_id IN
    SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
  LOOP
    -- Only update if this contract is newer than the billboard's current contract
    UPDATE billboards
      SET "Contract_Number" = v_contract."Contract_Number",
          "Customer_Name" = v_contract."Customer Name",
          "Ad_Type" = v_contract."Ad Type",
          "Rent_Start_Date" = v_contract."Contract Date",
          "Rent_End_Date" = v_contract."End Date",
          "Status" = 'محجوز'
      WHERE "ID" = v_billboard_id
        AND (
          "Contract_Number" IS NULL
          OR "Contract_Number" <= v_contract."Contract_Number"
          OR "Rent_End_Date" IS NULL
          OR "Rent_End_Date"::date < v_contract."End Date"::date
        );
    GET DIAGNOSTICS row_ct = ROW_COUNT;
    updated_count := updated_count + COALESCE(row_ct, 0);
  END LOOP;

  RETURN json_build_object('ok', true, 'updated', updated_count);
END;
$function$;

-- 3. Improve cleanup_expired_billboards to check for active contracts before cleaning
CREATE OR REPLACE FUNCTION public.cleanup_expired_billboards()
 RETURNS TABLE(cleaned_count integer, cleaned_billboard_ids integer[], operation_timestamp timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expired_ids INTEGER[];
  cleaned_count_result INTEGER := 0;
  operation_time TIMESTAMPTZ := NOW();
BEGIN
  -- Find billboards whose current rent has expired
  -- BUT exclude those that have a newer active contract referencing them
  SELECT ARRAY_AGG(b."ID") INTO expired_ids
  FROM billboards b
  WHERE b."Status" IN ('مؤجر', 'محجوز', 'rented')
    AND b."Rent_End_Date" IS NOT NULL 
    AND b."Rent_End_Date"::date < CURRENT_DATE
    -- Exclude if billboard is referenced in any active contract
    AND NOT EXISTS (
      SELECT 1 FROM "Contract" c
      WHERE c."End Date" IS NOT NULL
        AND c."End Date"::date >= CURRENT_DATE
        AND c.billboard_ids IS NOT NULL
        AND b."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[])
    );
  
  IF expired_ids IS NULL OR array_length(expired_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0::INTEGER, ARRAY[]::INTEGER[], operation_time;
    RETURN;
  END IF;
  
  UPDATE billboards 
  SET 
    "Status" = 'متاح',
    "Contract_Number" = NULL,
    "Customer_Name" = NULL,
    "Rent_Start_Date" = NULL,
    "Rent_End_Date" = NULL
  WHERE "ID" = ANY(expired_ids);
  
  GET DIAGNOSTICS cleaned_count_result = ROW_COUNT;
  
  BEGIN
    INSERT INTO cleanup_logs (
      cleanup_date,
      billboards_cleaned,
      cleanup_type,
      notes,
      billboard_ids_cleaned
    ) VALUES (
      operation_time,
      cleaned_count_result,
      'automatic',
      'Automatic cleanup via scheduled function',
      expired_ids
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  
  RETURN QUERY SELECT cleaned_count_result, expired_ids, operation_time;
END;
$function$;

-- 4. Also improve cleanup_orphaned_data to respect active contracts
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Clean billboards with contract numbers that no longer exist
    UPDATE billboards 
    SET "Status" = 'متاح',
        "Customer_Name" = NULL,
        "Contract_Number" = NULL,
        "Rent_Start_Date" = NULL,
        "Rent_End_Date" = NULL
    WHERE "Contract_Number" IS NOT NULL 
    AND NOT EXISTS (
        SELECT 1 FROM "Contract" 
        WHERE "Contract_Number" = billboards."Contract_Number"
    )
    -- But don't clean if referenced in another active contract
    AND NOT EXISTS (
        SELECT 1 FROM "Contract" c
        WHERE c."End Date" IS NOT NULL
          AND c."End Date"::date >= CURRENT_DATE
          AND c.billboard_ids IS NOT NULL
          AND billboards."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[])
    );
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    -- Clean expired billboards, but only if not in any active contract
    UPDATE billboards 
    SET "Status" = 'متاح',
        "Contract_Number" = NULL,
        "Customer_Name" = NULL,
        "Rent_Start_Date" = NULL,
        "Rent_End_Date" = NULL
    WHERE "Status" IN ('مؤجر', 'محجوز')
    AND "Rent_End_Date" IS NOT NULL
    AND "Rent_End_Date"::date < CURRENT_DATE
    AND NOT EXISTS (
        SELECT 1 FROM "Contract" c
        WHERE c."End Date" IS NOT NULL
          AND c."End Date"::date >= CURRENT_DATE
          AND c.billboard_ids IS NOT NULL
          AND billboards."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[])
    );
    
    RETURN cleaned_count;
END;
$function$;
