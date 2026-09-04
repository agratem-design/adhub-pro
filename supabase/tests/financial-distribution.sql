-- Run after migrations on a test database. All fixture rows are rolled back.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE customer uuid:=gen_random_uuid(); employee uuid:=gen_random_uuid(); expense uuid:=gen_random_uuid();
  other_expense uuid:=gen_random_uuid(); request uuid:=gen_random_uuid(); request2 uuid:=gen_random_uuid();
  payload jsonb; changed jsonb; group_id text:='dist-test-'||gen_random_uuid()::text; ids jsonb;
  custody uuid; balance numeric; count_rows integer; payment uuid; direct_request uuid:=gen_random_uuid(); payroll uuid; contract_no bigint;
BEGIN
  INSERT INTO auth.users(id) VALUES(gen_random_uuid()) RETURNING id INTO payment;
  PERFORM set_config('request.jwt.claim.sub',payment::text,true);
  INSERT INTO customers(id,name) VALUES(customer,'اختبار مالي مؤقت');
  SELECT COALESCE(max("Contract_Number"),0)+10000 INTO contract_no FROM "Contract";
  INSERT INTO "Contract"("Contract_Number",customer_id,"Customer Name","Total","Total Rent","Total Paid","Contract Date",operating_fee_rate)
    VALUES(contract_no,customer,'اختبار مالي مؤقت',100,100,'0','2099-01-01',0);
  INSERT INTO employees(id,name,position,base_salary,hire_date,status) VALUES(employee,'اختبار مالي مؤقت','اختبار',0,CURRENT_DATE,'active');
  INSERT INTO expenses(id,description,amount,category,payment_status,employee_id) VALUES(expense,'اختبار توزيع',100,'اختبار','unpaid',employee);
  INSERT INTO expenses(id,description,amount,category,payment_status) VALUES(other_expense,'اختبار مباشر',100,'اختبار','unpaid');
  payload:=jsonb_build_object('group_id',group_id,'customer_id',customer,'customer_name','اختبار مالي مؤقت','amount',100,'fees',0,'date','2026-09-03','method','نقدي','expected_payment_ids','[]'::jsonb,
    'payments',jsonb_build_array(jsonb_build_object('amount',100,'contract_number',contract_no,'method','نقدي','paid_at','2026-09-03','customer_name','اختبار مالي مؤقت','intermediary_commission',0,'transfer_fee',0)),
    'employees',jsonb_build_array(jsonb_build_object('employeeId',employee,'amount',20,'paymentType','advance')),
    'custody',jsonb_build_array(jsonb_build_object('employeeId',employee,'amount',20)),
    'expenses',jsonb_build_array(jsonb_build_object('expense_id',expense,'amount',60)),'rentals','[]'::jsonb);
  PERFORM save_payment_distribution(request,payload);
  PERFORM save_payment_distribution(request,payload);
  SELECT count(*) INTO count_rows FROM customer_payments WHERE distributed_payment_id=group_id;
  IF count_rows<>1 THEN RAISE EXCEPTION 'Retry duplicated receipts'; END IF;
  IF (SELECT "Total Paid"::numeric FROM "Contract" WHERE "Contract_Number"=contract_no)<>100 THEN RAISE EXCEPTION 'Contract total mismatch'; END IF;
  IF (SELECT paid_amount FROM expenses WHERE id=expense)<>60 THEN RAISE EXCEPTION 'Expense total mismatch'; END IF;
  IF (SELECT count(*) FROM employee_advances WHERE distributed_payment_id=group_id)<>1 THEN RAISE EXCEPTION 'Retry duplicated advance'; END IF;
  SELECT id INTO custody FROM custody_accounts WHERE source_payment_id=group_id;
  SELECT jsonb_agg(id) INTO ids FROM customer_payments WHERE distributed_payment_id=group_id;
  -- A late expense failure must restore deleted receipts, advances and withdrawals.
  PERFORM record_expense_payment(other_expense,80,'2026-09-03','cash',NULL,gen_random_uuid());
  changed:=payload || jsonb_build_object('expected_payment_ids',ids,'expenses',jsonb_build_array(jsonb_build_object('expense_id',other_expense,'amount',60)));
  BEGIN
    PERFORM save_payment_distribution(request2,changed);
    RAISE EXCEPTION 'Expected expense rejection was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Expected expense rejection was not raised' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%المصروف%' THEN RAISE; END IF;
  END;
  IF (SELECT paid_amount FROM expenses WHERE id=expense)<>60 OR (SELECT amount FROM employee_advances WHERE distributed_payment_id=group_id)<>20 THEN RAISE EXCEPTION 'Failed edit lost original data'; END IF;
  IF (SELECT jsonb_agg(id) FROM customer_payments WHERE distributed_payment_id=group_id)<>ids THEN RAISE EXCEPTION 'Failed edit replaced receipt IDs'; END IF;
  -- A valid edit updates custody funding once and recomputes the expense.
  changed:=payload || jsonb_build_object('expected_payment_ids',ids,'employees',jsonb_build_array(jsonb_build_object('employeeId',employee,'amount',10,'paymentType','advance')),
    'custody',jsonb_build_array(jsonb_build_object('employeeId',employee,'amount',40)),
    'expenses',jsonb_build_array(jsonb_build_object('expense_id',expense,'amount',50)));
  PERFORM save_payment_distribution(request2,changed);
  IF (SELECT current_balance FROM custody_accounts WHERE id=custody)<>40 THEN RAISE EXCEPTION 'Custody funding mismatch'; END IF;
  IF (SELECT paid_amount FROM expenses WHERE id=expense)<>50 THEN RAISE EXCEPTION 'Edited expense mismatch'; END IF;
  -- A separate expense avoids cancelling a distribution-linked settlement.
  DELETE FROM expense_payments WHERE expense_id=other_expense;
  payment:=record_expense_payment(other_expense,10,'2026-09-03','custody:'||custody::text,NULL,direct_request);
  PERFORM record_expense_payment(other_expense,10,'2026-09-03','custody:'||custody::text,NULL,direct_request);
  IF (SELECT current_balance FROM custody_accounts WHERE id=custody)<>30 THEN RAISE EXCEPTION 'Custody deducted more than once'; END IF;
  PERFORM cancel_expense_settlement(other_expense);
  IF (SELECT current_balance FROM custody_accounts WHERE id=custody)<>40 THEN RAISE EXCEPTION 'Custody refund mismatch'; END IF;
  IF (SELECT paid_amount FROM expenses WHERE id=other_expense)<>0 THEN RAISE EXCEPTION 'Cancel did not reset expense'; END IF;
  BEGIN
    PERFORM record_expense_payment(other_expense,50,'2026-09-03','custody:'||custody::text,NULL,gen_random_uuid());
    RAISE EXCEPTION 'Expected custody rejection was not raised';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Expected custody rejection was not raised' THEN RAISE; END IF;
    IF SQLERRM NOT LIKE '%العهدة%' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM expense_payments WHERE expense_id=other_expense) THEN RAISE EXCEPTION 'Failed custody payment left a settlement'; END IF;
  UPDATE employees SET base_salary=100,salary_type='monthly' WHERE id=employee;
  INSERT INTO employee_advances(employee_id,amount,remaining,status,request_date) VALUES(employee,250,250,'approved','2026-09-03');
  payroll:=create_payroll_draft('2099-01-01','2099-01-31');
  IF (SELECT net_salary FROM payroll_items WHERE payroll_id=payroll AND employee_id=employee)<>0 THEN RAISE EXCEPTION 'Payroll must cap advance deductions at the salary'; END IF;
  DELETE FROM payroll_items WHERE payroll_id=payroll AND employee_id<>employee;
  SELECT sum(remaining) INTO balance FROM employee_advances WHERE employee_id=employee;
  PERFORM settle_payroll_run(payroll);
  PERFORM settle_payroll_run(payroll);
  IF (SELECT sum(remaining) FROM employee_advances WHERE employee_id=employee)<>balance-100 THEN RAISE EXCEPTION 'Payroll deducted advances more than once'; END IF;
  IF (SELECT sum(s.amount) FROM payroll_advance_settlements s JOIN payroll_items i ON i.id=s.payroll_item_id WHERE i.payroll_id=payroll)<>100 THEN RAISE EXCEPTION 'Missing payroll advance audit trail'; END IF;
  request:=gen_random_uuid();
  request2:=gen_random_uuid();
  payment:=create_expense_with_settlement(jsonb_build_object('employee_id',employee,'amount',100,'description','اختبار مستحقات مصروف','category','اختبار','expense_date','2026-09-03','payment_status','unpaid'),request,NULL);
  PERFORM pay_employee_due(employee,40,'نقدي',NULL,NULL,request2);
  PERFORM pay_employee_due(employee,40,'نقدي',NULL,NULL,request2);
  IF (SELECT paid_amount FROM expenses WHERE id=payment)<>40 THEN RAISE EXCEPTION 'Employee reimbursement did not settle the expense'; END IF;
  IF (SELECT sum(CASE WHEN entry_type='credit' THEN amount ELSE -amount END) FROM employee_credit_entries WHERE expense_id=payment)<>60 THEN RAISE EXCEPTION 'Employee expense ledger balance mismatch'; END IF;
  BEGIN
    UPDATE expenses SET amount=39 WHERE id=payment;
    RAISE EXCEPTION 'Expected paid expense reduction rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Expected paid expense reduction rejection' OR SQLERRM NOT LIKE '%قيمة المصروف%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO expenses_withdrawals(amount,date,method) VALUES(GREATEST(1,COALESCE(available_operating_balance(),0)+1),CURRENT_DATE,'نقدي');
    RAISE EXCEPTION 'Expected operating overdraft rejection';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Expected operating overdraft rejection' OR SQLERRM NOT LIKE '%السحب يتجاوز%' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'Atomic create/edit/rollback/retry, custody refund, payroll, employee expense ledger and overdraft checks passed';
END $$;

ROLLBACK;
