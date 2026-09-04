-- A payment and its custody movement must succeed or fail together.
-- Invoker rights preserve the caller's existing row-level permissions.
ALTER TABLE public.custody_expenses ADD COLUMN IF NOT EXISTS expense_payment_id uuid
  REFERENCES public.expense_payments(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS custody_expenses_expense_payment_unique
  ON public.custody_expenses(expense_payment_id) WHERE expense_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_expense_payment_amount()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_amount numeric; v_paid numeric;
BEGIN
  SELECT amount INTO v_amount FROM expenses WHERE id = NEW.expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المصروف غير موجود أو لا تملك صلاحية الوصول إليه'; END IF;
  SELECT COALESCE(sum(amount), 0) INTO v_paid FROM expense_payments
    WHERE expense_id = NEW.expense_id AND id IS DISTINCT FROM NEW.id;
  IF NEW.amount <= 0 OR NEW.amount::text IN ('NaN', 'Infinity', '-Infinity') OR v_paid + NEW.amount > v_amount THEN
    RAISE EXCEPTION 'مبلغ السداد يتجاوز المتبقي على المصروف أو غير صالح';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expense_payment_amount_guard ON public.expense_payments;
CREATE TRIGGER expense_payment_amount_guard BEFORE INSERT OR UPDATE ON public.expense_payments
  FOR EACH ROW EXECUTE FUNCTION public.guard_expense_payment_amount();

CREATE OR REPLACE FUNCTION public.record_expense_payment(
  p_expense_id uuid, p_amount numeric, p_paid_at timestamptz,
  p_source text, p_notes text DEFAULT NULL, p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_expense expenses%ROWTYPE; v_custody custody_accounts%ROWTYPE; v_id uuid; v_existing expense_payments%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  SELECT * INTO v_existing FROM expense_payments WHERE id = p_request_id;
  IF FOUND THEN
    IF v_existing.expense_id IS DISTINCT FROM p_expense_id OR v_existing.amount IS DISTINCT FROM p_amount
      OR v_existing.payment_source IS DISTINCT FROM p_source OR v_existing.paid_at IS DISTINCT FROM p_paid_at THEN
      RAISE EXCEPTION 'مرجع السداد مستخدم لعملية مختلفة';
    END IF;
    RETURN v_existing.id;
  END IF;
  IF p_paid_at IS NULL OR p_amount IS NULL OR p_source IS NULL THEN RAISE EXCEPTION 'بيانات السداد غير مكتملة'; END IF;
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المصروف غير متاح'; END IF;
  IF p_source LIKE 'custody:%' THEN
    SELECT * INTO v_custody FROM custody_accounts WHERE id = substring(p_source FROM 9)::uuid FOR UPDATE;
    IF NOT FOUND OR v_custody.status <> 'active' OR v_custody.current_balance < p_amount THEN
      RAISE EXCEPTION 'رصيد العهدة غير كافٍ أو العهدة غير نشطة';
    END IF;
  END IF;
  INSERT INTO expense_payments(id, expense_id, amount, paid_at, paid_via, payment_source, notes)
    VALUES(p_request_id, p_expense_id, p_amount, p_paid_at, 'direct', p_source, p_notes) RETURNING id INTO v_id;
  IF p_source LIKE 'custody:%' THEN
    INSERT INTO custody_expenses(custody_account_id, expense_payment_id, description, amount, expense_category, expense_date, notes)
      VALUES(v_custody.id, v_id, 'سداد مصروف: ' || v_expense.description, p_amount, 'expense_payment', p_paid_at::date, 'expense_id=' || p_expense_id::text);
    -- custody_expense_balance_trigger is the sole writer of the balance delta.
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.record_expense_payment(uuid,numeric,timestamptz,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_expense_payment(uuid,numeric,timestamptz,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_expense_settlement(p_expense_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_expense expenses%ROWTYPE;
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id=p_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'المصروف غير متاح'; END IF;
  -- Existing linked withdrawals must be edited from their source distribution.
  IF EXISTS(SELECT 1 FROM expense_payments WHERE expense_id=p_expense_id AND distributed_payment_id IS NOT NULL) THEN
    RAISE EXCEPTION 'عدّل سداد المصروف من الدفعة الموزعة المرتبطة';
  END IF;
  -- Legacy custody rows have no exact payment relation; avoid ambiguous refunds.
  IF EXISTS(SELECT 1 FROM expense_payments p WHERE p.expense_id=p_expense_id AND p.payment_source LIKE 'custody:%'
      AND NOT EXISTS(SELECT 1 FROM custody_expenses c WHERE c.expense_payment_id=p.id)) THEN
    RAISE EXCEPTION 'السداد القديم من العهدة يحتاج مطابقة حركة العهدة قبل الإلغاء';
  END IF;
  DELETE FROM expense_payments WHERE expense_id=p_expense_id;
  -- Cascade removes exactly the linked custody movement; its trigger refunds once.
END $$;
REVOKE ALL ON FUNCTION public.cancel_expense_settlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_expense_settlement(uuid) TO authenticated;
