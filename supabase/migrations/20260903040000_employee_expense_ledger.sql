ALTER TABLE public.employee_credit_entries ADD COLUMN IF NOT EXISTS expense_payment_id uuid REFERENCES public.expense_payments(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS employee_credit_entries_payment_idx ON public.employee_credit_entries(expense_payment_id) WHERE expense_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_employee_expense_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE employee uuid; balance numeric;
BEGIN
  IF TG_OP='UPDATE' THEN DELETE FROM employee_credit_entries WHERE expense_payment_id=NEW.id; END IF;
  -- Only reimburse an employee where an explicit expense credit already exists.
  SELECT employee_id INTO employee FROM employee_credit_entries WHERE expense_id=NEW.expense_id AND entry_type='credit' LIMIT 1;
  IF employee IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM employees WHERE id=employee FOR UPDATE;
  SELECT COALESCE(sum(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) INTO balance FROM employee_credit_entries WHERE employee_id=employee;
  INSERT INTO employee_credit_entries(employee_id,expense_id,expense_payment_id,entry_type,amount,balance_after,description,payment_method,reference_number,entry_date)
    VALUES(employee,NEW.expense_id,NEW.id,'debit',NEW.amount,balance-NEW.amount,'سداد مصروف مستحق للموظف',NEW.paid_via,NEW.distributed_payment_id,NEW.paid_at::date);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS employee_expense_payment_sync ON public.expense_payments;
CREATE TRIGGER employee_expense_payment_sync AFTER INSERT OR UPDATE ON public.expense_payments FOR EACH ROW EXECUTE FUNCTION public.sync_employee_expense_payment();

CREATE OR REPLACE FUNCTION public.create_expense_with_settlement(p_expense jsonb,p_request_id uuid,p_custody_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE expense expenses%ROWTYPE; employee uuid:=NULLIF(p_expense->>'employee_id','')::uuid; balance numeric; status text:=p_expense->>'payment_status';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  SELECT * INTO expense FROM expenses WHERE id=p_request_id;
  IF FOUND THEN
    IF expense.amount IS DISTINCT FROM (p_expense->>'amount')::numeric OR expense.description IS DISTINCT FROM (p_expense->>'description') THEN RAISE EXCEPTION 'سبق استخدام مرجع المصروف؛ أعد فتحه للتعديل'; END IF;
    RETURN expense.id;
  END IF;
  IF (p_expense->>'amount')::numeric<=0 OR (p_expense->>'amount') IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'مبلغ المصروف غير صالح'; END IF;
  INSERT INTO expenses(id,description,amount,category,expense_date,payment_method,notes,receiver_name,sender_name,employee_id,payment_status)
    VALUES(p_request_id,p_expense->>'description',(p_expense->>'amount')::numeric,p_expense->>'category',(p_expense->>'expense_date')::date,
      p_expense->>'payment_method',p_expense->>'notes',p_expense->>'receiver_name',p_expense->>'sender_name',employee,'unpaid');
  IF employee IS NOT NULL AND p_custody_id IS NULL THEN
    PERFORM 1 FROM employees WHERE id=employee FOR UPDATE;
    SELECT COALESCE(sum(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) INTO balance FROM employee_credit_entries WHERE employee_id=employee;
    INSERT INTO employee_credit_entries(employee_id,expense_id,entry_type,amount,balance_after,description,entry_date)
      VALUES(employee,p_request_id,'credit',(p_expense->>'amount')::numeric,balance+(p_expense->>'amount')::numeric,'مصروف: ' || (p_expense->>'description'),(p_expense->>'expense_date')::date);
  END IF;
  IF status='paid' OR p_custody_id IS NOT NULL THEN
    PERFORM record_expense_payment(p_request_id,(p_expense->>'amount')::numeric,COALESCE(NULLIF(p_expense->>'paid_date','')::timestamptz,(p_expense->>'expense_date')::timestamptz),
      CASE WHEN p_custody_id IS NOT NULL THEN 'custody:' || p_custody_id::text ELSE COALESCE(NULLIF(p_expense->>'payment_method',''),'cash') END,NULL,gen_random_uuid());
  ELSIF status='partial' THEN RAISE EXCEPTION 'أضف المصروف ثم أدخل مبلغ السداد الجزئي'; END IF;
  RETURN p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.create_expense_with_settlement(jsonb,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense_with_settlement(jsonb,uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.pay_employee_due(p_employee uuid,p_amount numeric,p_method text,p_reference text,p_notes text,p_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE balance numeric; entry employee_credit_entries%ROWTYPE; expense record; remaining_payment numeric; part numeric; request_hash text;
BEGIN
  PERFORM 1 FROM employees WHERE id=p_employee FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الموظف غير متاح'; END IF;
  request_hash:=md5(jsonb_build_array(p_employee,p_amount,p_method,p_reference,p_notes)::text);
  IF EXISTS(SELECT 1 FROM payment_distribution_requests WHERE request_id=p_request_id) THEN
    IF NOT EXISTS(SELECT 1 FROM payment_distribution_requests WHERE request_id=p_request_id AND payload_hash=request_hash) THEN RAISE EXCEPTION 'مرجع السداد مستخدم'; END IF;
    RETURN p_request_id;
  END IF;
  SELECT * INTO entry FROM employee_credit_entries WHERE id=p_request_id;
  IF FOUND THEN
    IF entry.employee_id IS DISTINCT FROM p_employee OR entry.amount IS DISTINCT FROM p_amount THEN RAISE EXCEPTION 'مرجع السداد مستخدم'; END IF;
    RETURN entry.id;
  END IF;
  SELECT COALESCE(sum(CASE WHEN entry_type='credit' THEN amount ELSE -amount END),0) INTO balance FROM employee_credit_entries WHERE employee_id=p_employee;
  IF p_amount IS NULL OR p_amount<=0 OR p_amount>balance OR p_amount::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'المبلغ يتجاوز مستحقات الموظف أو غير صالح'; END IF;
  remaining_payment:=p_amount;
  -- Settle expense-backed dues through the expense ledger, which records the
  -- employee debit too. This avoids marking the employee paid while leaving
  -- their reimbursable expense unpaid.
  FOR expense IN SELECT e.id,e.amount FROM expenses e WHERE EXISTS(
      SELECT 1 FROM employee_credit_entries c WHERE c.expense_id=e.id AND c.employee_id=p_employee AND c.entry_type='credit')
      ORDER BY e.expense_date,e.id FOR UPDATE LOOP
    EXIT WHEN remaining_payment<=0;
    SELECT LEAST(remaining_payment,GREATEST(0,expense.amount-COALESCE(sum(amount),0))) INTO part FROM expense_payments WHERE expense_id=expense.id;
    IF part>0 THEN
      PERFORM record_expense_payment(expense.id,part,now(),COALESCE(p_method,'cash'),p_notes,gen_random_uuid());
      remaining_payment:=remaining_payment-part;
    END IF;
  END LOOP;
  IF remaining_payment>0 THEN
    INSERT INTO employee_credit_entries(id,employee_id,entry_type,amount,balance_after,description,payment_method,reference_number,notes)
      VALUES(p_request_id,p_employee,'debit',remaining_payment,balance-p_amount,'سداد مستحقات للموظف',p_method,p_reference,p_notes);
  END IF;
  INSERT INTO payment_distribution_requests(request_id,group_id,payload_hash) VALUES(p_request_id,'employee:'||p_employee::text,request_hash);
  RETURN p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.pay_employee_due(uuid,numeric,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_employee_due(uuid,numeric,text,text,text,uuid) TO authenticated;
