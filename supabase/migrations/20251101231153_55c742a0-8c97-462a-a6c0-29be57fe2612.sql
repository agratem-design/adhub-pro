-- Fix: recreate sync function with correct GET DIAGNOSTICS usage
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
AS $$
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
      WHERE "ID" = v_billboard_id;
    GET DIAGNOSTICS row_ct = ROW_COUNT;
    updated_count := updated_count + COALESCE(row_ct, 0);
  END LOOP;

  RETURN json_build_object('ok', true, 'updated', updated_count);
END;
$$;

-- Trigger wrapper
CREATE OR REPLACE FUNCTION public.t_sync_billboards_from_contract()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.sync_billboards_from_contract(NEW."Contract_Number");
  RETURN NEW;
END;
$$;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_sync_billboards_from_contract_insupd ON "Contract";
CREATE TRIGGER trg_sync_billboards_from_contract_insupd
AFTER INSERT OR UPDATE OF billboard_ids, "Customer Name", "Ad Type", "Contract Date", "End Date"
ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION public.t_sync_billboards_from_contract();

-- Ensure billboard status auto-updates from dates
DROP TRIGGER IF EXISTS trg_update_billboard_status_based_on_dates ON billboards;
CREATE TRIGGER trg_update_billboard_status_based_on_dates
BEFORE INSERT OR UPDATE OF "Rent_Start_Date", "Rent_End_Date"
ON billboards
FOR EACH ROW
EXECUTE FUNCTION public.update_billboard_status_based_on_dates();

-- One-time sync for all existing contracts
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT "Contract_Number" FROM "Contract" WHERE billboard_ids IS NOT NULL AND TRIM(billboard_ids) <> '' LOOP
    PERFORM public.sync_billboards_from_contract(c."Contract_Number");
  END LOOP;
END$$;