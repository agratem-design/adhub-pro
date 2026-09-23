-- Fix delete_contract_atomic and foreign key constraints, with payment protection guard

-- 1. Ensure foreign key constraints on tables referencing Contract have ON DELETE CASCADE
ALTER TABLE public.installation_team_accounts 
  DROP CONSTRAINT IF EXISTS installation_team_accounts_contract_id_fkey,
  ADD CONSTRAINT installation_team_accounts_contract_id_fkey 
    FOREIGN KEY (contract_id) REFERENCES public."Contract"("Contract_Number") ON DELETE CASCADE;

ALTER TABLE public.print_tasks 
  DROP CONSTRAINT IF EXISTS print_tasks_contract_id_fkey,
  ADD CONSTRAINT print_tasks_contract_id_fkey 
    FOREIGN KEY (contract_id) REFERENCES public."Contract"("Contract_Number") ON DELETE CASCADE;

ALTER TABLE public.billboard_extensions 
  DROP CONSTRAINT IF EXISTS billboard_extensions_contract_number_fkey,
  ADD CONSTRAINT billboard_extensions_contract_number_fkey 
    FOREIGN KEY (contract_number) REFERENCES public."Contract"("Contract_Number") ON DELETE CASCADE;

-- 2. Drop the 1-argument overloaded function to prevent PGRST203 ambiguity in PostgREST
DROP FUNCTION IF EXISTS public.delete_contract_atomic(bigint);

-- 3. Update delete_contract_atomic to prevent deleting contracts with existing payments,
--    and cleanly delete all contract-associated records if unpaid.
CREATE OR REPLACE FUNCTION public.delete_contract_atomic(
  p_contract_number bigint, 
  p_expected_version integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_current_version INT;
  v_ids_str TEXT;
  v_total_paid NUMERIC := 0;
  v_payments_count INT := 0;
  v_contract_total_paid NUMERIC := 0;
BEGIN
  -- 1. Lock Contract row
  SELECT "billboard_ids", COALESCE("version", 1), COALESCE(NULLIF("Total Paid", ''), '0')::numeric 
  INTO v_ids_str, v_current_version, v_contract_total_paid
  FROM public."Contract"
  WHERE "Contract_Number" = p_contract_number
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONTRACT_NOT_FOUND: Contract % does not exist', p_contract_number;
  END IF;

  IF p_expected_version IS NOT NULL AND v_current_version <> p_expected_version THEN
    RAISE EXCEPTION 'CONTRACT_VERSION_CONFLICT: Contract % was modified (expected %, current %)', p_contract_number, p_expected_version, v_current_version;
  END IF;

  -- 2. قيد الحماية: منع حذف العقد في حال وجود أي سداد تم
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
  INTO v_total_paid, v_payments_count
  FROM public.customer_payments
  WHERE contract_number = p_contract_number AND amount > 0;

  IF v_payments_count > 0 AND v_total_paid > 0 THEN
    RAISE EXCEPTION 'CONTRACT_HAS_PAYMENTS: لا يمكن حذف العقد #% نظراً لوجود دفعات مسددة مرتبطة به بإجمالي % د.ل (عدد الدفعات: %). يرجى تسوية أو إلغاء الدفعات أولاً.',
      p_contract_number, v_total_paid, v_payments_count;
  END IF;

  IF v_contract_total_paid > 0 THEN
    RAISE EXCEPTION 'CONTRACT_HAS_PAYMENTS: لا يمكن حذف العقد #% نظراً لوجود مبالغ مسددة مسجلة بالعقد بقيمة % د.ل. يرجى تسوية الدفعات أولاً.',
      p_contract_number, v_contract_total_paid;
  END IF;

  -- 3. Lock and release billboards (Preserve false if in maintenance)
  PERFORM "ID" FROM public.billboards WHERE "Contract_Number" = p_contract_number ORDER BY "ID" FOR UPDATE;

  UPDATE public.billboards
  SET
    "Contract_Number" = NULL,
    "Customer_Name" = NULL,
    "Ad_Type" = NULL,
    "Rent_Start_Date" = NULL,
    "Rent_End_Date" = NULL,
    "Status" = 'متاح',
    "Days_Count" = NULL,
    is_visible_in_available = CASE WHEN is_visible_in_available = false THEN false ELSE NULL END
  WHERE "Contract_Number" = p_contract_number;

  -- 4. Clean up related child tables in proper dependency order
  -- A. Installation team accounts
  DELETE FROM public.installation_team_accounts WHERE contract_id = p_contract_number;

  -- B. Payments & expenses & shares
  DELETE FROM public.customer_payments WHERE contract_number = p_contract_number;
  DELETE FROM public.contract_expenses WHERE contract_number = p_contract_number;
  DELETE FROM public.partnership_contract_shares WHERE contract_id = p_contract_number;

  -- C. Friend rentals & extensions & history
  DELETE FROM public.friend_billboard_rentals WHERE contract_number = p_contract_number;
  DELETE FROM public.billboard_extensions WHERE contract_number = p_contract_number;
  DELETE FROM public.billboard_history WHERE contract_number = p_contract_number;

  -- D. Tasks
  DELETE FROM public.removal_tasks WHERE contract_id = p_contract_number;
  DELETE FROM public.composite_tasks WHERE contract_id = p_contract_number;
  DELETE FROM public.installation_tasks WHERE contract_id = p_contract_number;
  DELETE FROM public.print_tasks WHERE contract_id = p_contract_number;

  -- 5. Delete Contract row
  DELETE FROM public."Contract" WHERE "Contract_Number" = p_contract_number;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_contract_number', p_contract_number
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_contract_atomic(bigint, integer) TO anon, authenticated, service_role;
