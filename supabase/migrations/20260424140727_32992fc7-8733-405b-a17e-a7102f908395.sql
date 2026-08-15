
-- 1) Extend expenses table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_via text,
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS paid_by_distributed_payment_id text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

-- 2) Create expense_payments table
CREATE TABLE IF NOT EXISTS public.expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_via text NOT NULL CHECK (paid_via IN ('direct','distributed_payment')),
  payment_source text,
  distributed_payment_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_payments_expense_id ON public.expense_payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_payments_distributed_payment_id ON public.expense_payments(distributed_payment_id);

ALTER TABLE public.expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_payments_select" ON public.expense_payments;
DROP POLICY IF EXISTS "expense_payments_insert" ON public.expense_payments;
DROP POLICY IF EXISTS "expense_payments_update" ON public.expense_payments;
DROP POLICY IF EXISTS "expense_payments_delete" ON public.expense_payments;

CREATE POLICY "expense_payments_select" ON public.expense_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "expense_payments_insert" ON public.expense_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "expense_payments_update" ON public.expense_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "expense_payments_delete" ON public.expense_payments FOR DELETE TO authenticated USING (true);

-- 3) Function to recompute expense paid status
CREATE OR REPLACE FUNCTION public.recompute_expense_payment_status(_expense_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_paid numeric;
  expense_amount numeric;
  new_status text;
  last_paid_date date;
  last_via text;
  last_source text;
  last_dist_id text;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO total_paid FROM public.expense_payments WHERE expense_id = _expense_id;
  SELECT amount INTO expense_amount FROM public.expenses WHERE id = _expense_id;

  IF total_paid <= 0 THEN
    new_status := 'unpaid';
  ELSIF total_paid >= expense_amount THEN
    new_status := 'paid';
  ELSE
    new_status := 'partial';
  END IF;

  SELECT (paid_at)::date, paid_via, payment_source, distributed_payment_id
    INTO last_paid_date, last_via, last_source, last_dist_id
  FROM public.expense_payments
  WHERE expense_id = _expense_id
  ORDER BY paid_at DESC
  LIMIT 1;

  UPDATE public.expenses
     SET paid_amount = total_paid,
         payment_status = new_status,
         paid_date = CASE WHEN new_status='paid' THEN COALESCE(last_paid_date, CURRENT_DATE) ELSE NULL END,
         paid_via = last_via,
         payment_source = last_source,
         paid_by_distributed_payment_id = last_dist_id,
         updated_at = now()
   WHERE id = _expense_id;
END;
$$;

-- 4) Trigger
CREATE OR REPLACE FUNCTION public.trg_expense_payments_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_expense_payment_status(OLD.expense_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_expense_payment_status(NEW.expense_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS expense_payments_sync_trg ON public.expense_payments;
CREATE TRIGGER expense_payments_sync_trg
AFTER INSERT OR UPDATE OR DELETE ON public.expense_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_expense_payments_sync();

-- 5) Backfill: for already-paid expenses without expense_payments rows, create one direct payment
INSERT INTO public.expense_payments (expense_id, amount, paid_at, paid_via, payment_source, notes)
SELECT e.id, e.amount, COALESCE(e.paid_date::timestamptz, e.updated_at, now()), 'direct',
       COALESCE(e.payment_method, 'cash'), 'تسوية تلقائية للسداد السابق'
FROM public.expenses e
WHERE e.payment_status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM public.expense_payments ep WHERE ep.expense_id = e.id);

-- Recompute all
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.expenses LOOP
    PERFORM public.recompute_expense_payment_status(r.id);
  END LOOP;
END $$;
