-- Function: recompute expense status from expense_payments
CREATE OR REPLACE FUNCTION public.recompute_expense_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_id uuid;
  v_amount numeric;
  v_paid numeric;
  v_last_paid_at timestamptz;
  v_status text;
  v_paid_date date;
BEGIN
  v_expense_id := COALESCE(NEW.expense_id, OLD.expense_id);
  IF v_expense_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT amount INTO v_amount FROM public.expenses WHERE id = v_expense_id;
  IF v_amount IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0), MAX(paid_at)
    INTO v_paid, v_last_paid_at
  FROM public.expense_payments
  WHERE expense_id = v_expense_id;

  IF v_paid >= v_amount AND v_amount > 0 THEN
    v_status := 'paid';
    v_paid_date := COALESCE(v_last_paid_at::date, CURRENT_DATE);
  ELSIF v_paid > 0 THEN
    v_status := 'partial';
    v_paid_date := COALESCE(v_last_paid_at::date, CURRENT_DATE);
  ELSE
    v_status := 'unpaid';
    v_paid_date := NULL;
  END IF;

  UPDATE public.expenses
     SET paid_amount = v_paid,
         payment_status = v_status,
         paid_date = v_paid_date,
         updated_at = now()
   WHERE id = v_expense_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_expense_payments_recompute ON public.expense_payments;
CREATE TRIGGER trg_expense_payments_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
FOR EACH ROW EXECUTE FUNCTION public.recompute_expense_payment_status();

-- Function: when manually setting payment_status to 'unpaid' on expenses,
-- delete linked direct expense_payments and reset paid_amount.
CREATE OR REPLACE FUNCTION public.handle_manual_expense_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'unpaid' AND COALESCE(OLD.payment_status, '') <> 'unpaid' THEN
    DELETE FROM public.expense_payments
     WHERE expense_id = NEW.id AND paid_via = 'direct';
    NEW.paid_amount := 0;
    NEW.paid_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_manual_status ON public.expenses;
CREATE TRIGGER trg_expenses_manual_status
BEFORE UPDATE OF payment_status ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_manual_expense_status_change();

-- Function: cascade delete expense_payments when distributed payment row is deleted
CREATE OR REPLACE FUNCTION public.cleanup_expense_payments_on_distributed_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dpid text;
BEGIN
  v_dpid := COALESCE(OLD.distributed_payment_id::text, OLD.id::text);
  IF v_dpid IS NOT NULL THEN
    DELETE FROM public.expense_payments
     WHERE distributed_payment_id = v_dpid;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_payments_cleanup_expenses ON public.customer_payments;
CREATE TRIGGER trg_customer_payments_cleanup_expenses
AFTER DELETE ON public.customer_payments
FOR EACH ROW EXECUTE FUNCTION public.cleanup_expense_payments_on_distributed_delete();

-- Backfill: recompute all expenses based on existing expense_payments
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT expense_id FROM public.expense_payments WHERE expense_id IS NOT NULL LOOP
    PERFORM 1;
    UPDATE public.expenses e
       SET paid_amount = COALESCE(sub.s, 0),
           payment_status = CASE
             WHEN COALESCE(sub.s,0) >= e.amount AND e.amount > 0 THEN 'paid'
             WHEN COALESCE(sub.s,0) > 0 THEN 'partial'
             ELSE 'unpaid' END,
           paid_date = CASE WHEN COALESCE(sub.s,0) > 0 THEN COALESCE(sub.last_at::date, CURRENT_DATE) ELSE NULL END
      FROM (SELECT SUM(amount) s, MAX(paid_at) last_at FROM public.expense_payments WHERE expense_id = r.expense_id) sub
     WHERE e.id = r.expense_id;
  END LOOP;
END $$;