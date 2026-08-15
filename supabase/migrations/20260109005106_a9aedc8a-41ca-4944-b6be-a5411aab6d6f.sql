-- Fix Function Search Path Mutable - Part 1
-- Add SET search_path = public to all trigger functions

-- 1. update_purchase_invoice_updated_at
CREATE OR REPLACE FUNCTION public.update_purchase_invoice_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 2. set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. delete_advance_on_payment_delete
CREATE OR REPLACE FUNCTION public.delete_advance_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.distributed_payment_id IS NOT NULL THEN
    DELETE FROM employee_advances 
    WHERE distributed_payment_id = OLD.distributed_payment_id;
  END IF;
  RETURN OLD;
END;
$$;

-- 4. lock_paid_invoice
CREATE OR REPLACE FUNCTION public.lock_paid_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid = TRUE AND OLD.paid = FALSE THEN
    NEW.locked = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. update_installation_tasks_updated_at
CREATE OR REPLACE FUNCTION public.update_installation_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 6. update_contract_payment_status
CREATE OR REPLACE FUNCTION public.update_contract_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- 7. update_customer_last_payment
CREATE OR REPLACE FUNCTION public.update_customer_last_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE customers 
  SET last_payment_date = NEW.paid_at 
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$;

-- 8. update_printers_updated_at
CREATE OR REPLACE FUNCTION public.update_printers_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 9. update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 10. update_contract_terms_updated_at
CREATE OR REPLACE FUNCTION public.update_contract_terms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 11. delete_withdrawal_on_payment_delete
CREATE OR REPLACE FUNCTION public.delete_withdrawal_on_payment_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN OLD;
END;
$$;

-- 12. update_print_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_print_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 13. delete_separate_task_invoices
CREATE OR REPLACE FUNCTION public.delete_separate_task_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN OLD;
END;
$$;

-- 14. update_billboards_updated_at
CREATE OR REPLACE FUNCTION public.update_billboards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 15. update_system_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 16. update_printed_invoices_updated_at
CREATE OR REPLACE FUNCTION public.update_printed_invoices_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 17. update_removal_tasks_updated_at
CREATE OR REPLACE FUNCTION public.update_removal_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 18. update_friend_companies_updated_at
CREATE OR REPLACE FUNCTION public.update_friend_companies_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 19. update_friend_rentals_updated_at
CREATE OR REPLACE FUNCTION public.update_friend_rentals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 20. update_employee_manual_tasks_updated_at
CREATE OR REPLACE FUNCTION public.update_employee_manual_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 21. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;