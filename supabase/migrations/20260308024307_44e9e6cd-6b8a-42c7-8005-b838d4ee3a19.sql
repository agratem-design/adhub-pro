
-- إصلاح اللوحات التي لديها عقود نشطة لكن بيانات قديمة
-- تحديث sync_billboards_from_contract لتشمل حالة المقارنة بتاريخ الانتهاء
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
          OR "Contract_Number" < v_contract."Contract_Number"
          OR "Rent_End_Date" IS NULL
          OR "Rent_End_Date"::date < v_contract."End Date"::date
        );
    GET DIAGNOSTICS row_ct = ROW_COUNT;
    updated_count := updated_count + COALESCE(row_ct, 0);
  END LOOP;

  RETURN json_build_object('ok', true, 'updated', updated_count);
END;
$function$
