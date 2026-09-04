CREATE TABLE IF NOT EXISTS public.payroll_advance_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items(id),
  advance_id uuid NOT NULL REFERENCES public.employee_advances(id),
  amount numeric NOT NULL CHECK(amount>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(payroll_item_id,advance_id)
);
ALTER TABLE public.payroll_advance_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_advance_settlements_authenticated ON public.payroll_advance_settlements
  FOR ALL TO authenticated USING(true) WITH CHECK(true);
GRANT SELECT,INSERT ON public.payroll_advance_settlements TO authenticated;

CREATE OR REPLACE FUNCTION public.create_payroll_draft(p_start date,p_end date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE run_id uuid; employee employees%ROWTYPE; deduction numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll-settlement',0));
  IF p_start IS NULL OR p_end IS NULL OR p_end<p_start THEN RAISE EXCEPTION 'فترة الرواتب غير صحيحة'; END IF;
  IF EXISTS(SELECT 1 FROM payroll_runs WHERE status<>'cancelled' AND period_start<=p_end AND period_end>=p_start) THEN RAISE EXCEPTION 'توجد دورة رواتب تغطي هذه الفترة؛ راجعها قبل إنشاء دورة جديدة'; END IF;
  IF NOT EXISTS(SELECT 1 FROM employees WHERE status='active' AND salary_type='monthly' AND base_salary>0) THEN RAISE EXCEPTION 'لا يوجد موظفون برواتب شهرية لإنشاء الدورة'; END IF;
  INSERT INTO payroll_runs(period_start,period_end,status) VALUES(p_start,p_end,'draft') RETURNING id INTO run_id;
  FOR employee IN SELECT * FROM employees WHERE status='active' AND salary_type='monthly' AND base_salary>0 ORDER BY id FOR UPDATE LOOP
    SELECT LEAST(employee.base_salary,COALESCE(sum(remaining),0)) INTO deduction FROM employee_advances
      WHERE employee_id=employee.id AND status='approved' AND request_date<=p_end;
    INSERT INTO payroll_items(payroll_id,employee_id,basic_salary,allowances,overtime_amount,deductions,advances_deduction,net_salary,paid)
      VALUES(run_id,employee.id,employee.base_salary,0,0,0,deduction,employee.base_salary-deduction,false);
  END LOOP;
  RETURN run_id;
END $$;
REVOKE ALL ON FUNCTION public.create_payroll_draft(date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payroll_draft(date,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_payroll_run(p_run_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE run payroll_runs%ROWTYPE; item payroll_items%ROWTYPE; advance employee_advances%ROWTYPE;
  remaining_deduction numeric; part numeric; available numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('payroll-settlement',0));
  SELECT * INTO run FROM payroll_runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'دورة الرواتب غير متاحة'; END IF;
  IF run.status='paid' THEN RETURN; END IF;
  IF run.status NOT IN ('draft','approved') THEN RAISE EXCEPTION 'حالة الدورة لا تسمح بالسداد'; END IF;
  IF NOT EXISTS(SELECT 1 FROM payroll_items WHERE payroll_id=p_run_id) THEN RAISE EXCEPTION 'الدورة لا تحتوي على رواتب'; END IF;
  FOR item IN SELECT * FROM payroll_items WHERE payroll_id=p_run_id AND NOT paid ORDER BY employee_id FOR UPDATE LOOP
    IF item.net_salary<0 OR item.deductions<0 OR item.advances_deduction<0 OR item.net_salary<>item.basic_salary+item.allowances+COALESCE(item.overtime_amount,0)-item.deductions-item.advances_deduction THEN RAISE EXCEPTION 'راجع احتساب صافي الراتب قبل السداد'; END IF;
    PERFORM 1 FROM employee_advances WHERE employee_id=item.employee_id AND status='approved' ORDER BY id FOR UPDATE;
    SELECT COALESCE(sum(remaining),0) INTO available FROM employee_advances WHERE employee_id=item.employee_id AND status='approved' AND request_date<=run.period_end;
    remaining_deduction:=item.advances_deduction;
    IF remaining_deduction>available THEN RAISE EXCEPTION 'تغير رصيد السلف منذ إنشاء المسودة؛ راجع خصومات الدورة'; END IF;
    FOR advance IN SELECT * FROM employee_advances WHERE employee_id=item.employee_id AND status='approved' AND request_date<=run.period_end ORDER BY request_date,id LOOP
      EXIT WHEN remaining_deduction<=0;
      part:=LEAST(remaining_deduction,advance.remaining);
      IF part<=0 THEN CONTINUE; END IF;
      INSERT INTO payroll_advance_settlements(payroll_item_id,advance_id,amount) VALUES(item.id,advance.id,part);
      UPDATE employee_advances SET remaining=remaining-part,status=CASE WHEN remaining-part=0 THEN 'settled' ELSE status END WHERE id=advance.id;
      remaining_deduction:=remaining_deduction-part;
    END LOOP;
    UPDATE payroll_items SET paid=true WHERE id=item.id;
  END LOOP;
  UPDATE payroll_runs SET status='paid',paid_at=now() WHERE id=p_run_id;
END $$;
REVOKE ALL ON FUNCTION public.settle_payroll_run(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_payroll_run(uuid) TO authenticated;
