
-- Recompute expense paid_amount and payment_status from expense_payments
CREATE OR REPLACE FUNCTION public.recompute_expense_paid_amount(_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_amount numeric;
  v_status text;
BEGIN
  IF _expense_id IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.expense_payments
  WHERE expense_id = _expense_id;

  SELECT amount INTO v_amount FROM public.expenses WHERE id = _expense_id;
  IF v_amount IS NULL THEN RETURN; END IF;

  IF v_total <= 0 THEN
    v_status := 'unpaid';
  ELSIF v_total >= v_amount - 0.001 THEN
    v_status := 'paid';
  ELSE
    v_status := 'partial';
  END IF;

  UPDATE public.expenses
  SET paid_amount = v_total,
      payment_status = v_status,
      paid_date = CASE WHEN v_status = 'paid' THEN COALESCE(paid_date, CURRENT_DATE) ELSE NULL END,
      updated_at = now()
  WHERE id = _expense_id;
END;
$$;

-- Trigger function for expense_payments
CREATE OR REPLACE FUNCTION public.trg_expense_payments_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_expense_paid_amount(OLD.expense_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND OLD.expense_id <> NEW.expense_id THEN
    PERFORM public.recompute_expense_paid_amount(OLD.expense_id);
    PERFORM public.recompute_expense_paid_amount(NEW.expense_id);
    RETURN NEW;
  ELSE
    PERFORM public.recompute_expense_paid_amount(NEW.expense_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS expense_payments_recompute_aiud ON public.expense_payments;
CREATE TRIGGER expense_payments_recompute_aiud
AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_expense_payments_recompute();

-- Trigger: when customer_payments is deleted, remove expense_payments tied to same distributed_payment_id
CREATE OR REPLACE FUNCTION public.trg_customer_payments_cleanup_expense_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.distributed_payment_id IS NOT NULL THEN
    DELETE FROM public.expense_payments
    WHERE distributed_payment_id = OLD.distributed_payment_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS customer_payments_cleanup_expense_payments ON public.customer_payments;
CREATE TRIGGER customer_payments_cleanup_expense_payments
BEFORE DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_customer_payments_cleanup_expense_payments();

-- Backfill: recompute all expenses that have payments
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT expense_id FROM public.expense_payments LOOP
    PERFORM public.recompute_expense_paid_amount(r.expense_id);
  END LOOP;
END $$;
