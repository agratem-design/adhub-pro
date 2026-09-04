-- Keep the receipt, contract allocations and its disbursements in one transaction.
ALTER TABLE public.installation_team_accounts ADD COLUMN IF NOT EXISTS distributed_payment_id text;
CREATE INDEX IF NOT EXISTS installation_team_accounts_distribution_idx ON public.installation_team_accounts(distributed_payment_id);
CREATE TABLE IF NOT EXISTS public.payment_distribution_requests (
  request_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  group_id text NOT NULL,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_distribution_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_distribution_requests_owner ON public.payment_distribution_requests
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
GRANT SELECT, INSERT ON public.payment_distribution_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.contract_collected_operating_fee(c jsonb, paid numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE rent numeric; installation numeric; print_cost numeric; total numeric; rate numeric; ratio numeric;
  friends jsonb; partners jsonb; friend_cost numeric; friend_fee numeric; partner_fee numeric;
BEGIN
  rent := COALESCE((c->>'Total Rent')::numeric,0);
  installation := COALESCE((c->>'installation_cost')::numeric,0);
  print_cost := COALESCE((c->>'print_cost')::numeric,0);
  total := COALESCE((c->>'Total')::numeric,rent+installation+print_cost);
  rate := COALESCE((c->>'operating_fee_rate')::numeric,0);
  ratio := CASE WHEN total > 0 THEN GREATEST(0, LEAST(1,paid/total)) ELSE 0 END;
  BEGIN
    friends := CASE WHEN jsonb_typeof(c->'friend_rental_data')='string' THEN (c->>'friend_rental_data')::jsonb ELSE c->'friend_rental_data' END;
    IF jsonb_typeof(friends) IS DISTINCT FROM 'array' THEN friends := '[]'; END IF;
  EXCEPTION WHEN invalid_text_representation THEN friends := '[]'; END;
  BEGIN
    partners := CASE WHEN jsonb_typeof(c->'partnership_operating_data')='string' THEN (c->>'partnership_operating_data')::jsonb ELSE c->'partnership_operating_data' END;
    IF jsonb_typeof(partners) IS DISTINCT FROM 'array' THEN partners := '[]'; END IF;
  EXCEPTION WHEN invalid_text_representation THEN partners := '[]'; END;
  SELECT COALESCE(sum(COALESCE((f->>'friendRentalCost')::numeric,(f->>'friend_rental_cost')::numeric,0)),0) INTO friend_cost FROM jsonb_array_elements(friends) f;
  friend_fee := CASE WHEN COALESCE((c->>'friend_rental_operating_fee_enabled')::boolean,false)
    THEN round(friend_cost*COALESCE((c->>'friend_rental_operating_fee_rate')::numeric,0)/100) ELSE 0 END;
  SELECT COALESCE(sum((p->>'operating_fee_amount')::numeric),0) INTO partner_fee FROM jsonb_array_elements(partners) p;
  RETURN round(GREATEST(0,rent-friend_cost)*ratio*rate/100)
    + CASE WHEN COALESCE((c->>'include_operating_in_installation')::boolean,false) THEN round(installation*ratio*COALESCE((c->>'operating_fee_rate_installation')::numeric,rate)/100) ELSE 0 END
    + CASE WHEN COALESCE((c->>'include_operating_in_print')::boolean,false) THEN round(print_cost*ratio*COALESCE((c->>'operating_fee_rate_print')::numeric,rate)/100) ELSE 0 END
    + round((friend_fee+partner_fee)*ratio);
END $$;

CREATE OR REPLACE FUNCTION public.available_operating_balance()
RETURNS numeric LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  WITH paid AS (
    SELECT contract_number,sum(amount) amount FROM customer_payments WHERE entry_type IN ('payment','receipt','account_payment') GROUP BY contract_number
  ), fees AS (
    SELECT c."Contract_Number" number, contract_collected_operating_fee(to_jsonb(c),COALESCE(p.amount,0)) fee,
      EXISTS(SELECT 1 FROM period_closures cl WHERE
        (cl.closure_type='contract_range' AND c."Contract_Number" BETWEEN cl.contract_start::bigint AND cl.contract_end::bigint)
        OR (cl.closure_type='period' AND c."Contract Date"::date BETWEEN cl.period_start::date AND cl.period_end::date)) closed
    FROM "Contract" c LEFT JOIN paid p ON p.contract_number=c."Contract_Number"
    WHERE c."Contract_Number">=1086 AND NOT EXISTS(SELECT 1 FROM expenses_flags f WHERE f.contract_id::text=c."Contract_Number"::text AND f.excluded)
  ), ordered AS (
    SELECT *,COALESCE(sum(fee) OVER(ORDER BY number ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) prior FROM fees
  ), withdrawals AS (SELECT COALESCE(sum(amount),0) amount FROM expenses_withdrawals)
  SELECT COALESCE(sum(CASE WHEN NOT closed THEN fee ELSE 0 END),0) - w.amount
    + COALESCE(sum(CASE WHEN closed THEN LEAST(fee,GREATEST(0,w.amount-prior)) ELSE 0 END),0)
  FROM ordered CROSS JOIN withdrawals w GROUP BY w.amount
$$;

CREATE OR REPLACE FUNCTION public.save_payment_distribution(p_request_id uuid, p_payload jsonb)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  group_id text := p_payload->>'group_id'; customer uuid := (p_payload->>'customer_id')::uuid;
  total numeric := (p_payload->>'amount')::numeric; fees numeric; outflow numeric; row jsonb;
  existing_request payment_distribution_requests%ROWTYPE; employee employees%ROWTYPE; account custody_accounts%ROWTYPE;
  team_account installation_team_accounts%ROWTYPE; receipt customer_payments%ROWTYPE; old_receipts jsonb;
  allocated numeric; due numeric; already_paid numeric; balance numeric; part numeric; remaining numeric;
  item_id uuid; old_purchase uuid; new_purchase uuid := NULLIF(p_payload->>'purchase_invoice_id','')::uuid;
  source_id uuid := NULLIF(p_payload->>'source_payment_id','')::uuid;
  actual_ids text[]; expected_ids text[]; reference_text text; old_total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'تسجيل الدخول مطلوب لحفظ التوزيع'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-distribution',0));
  SELECT * INTO existing_request FROM payment_distribution_requests WHERE request_id=p_request_id;
  IF FOUND THEN
    IF existing_request.payload_hash <> md5(p_payload::text) THEN RAISE EXCEPTION 'سبق حفظ هذا الطلب؛ أعد فتح الدفعة للتعديل'; END IF;
    RETURN existing_request.group_id;
  END IF;
  IF group_id IS NULL OR total IS NULL OR total<=0 OR total::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'مبلغ الدفعة غير صالح'; END IF;
  PERFORM 1 FROM customers WHERE id=customer FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'العميل غير متاح'; END IF;
  fees := COALESCE((p_payload->>'fees')::numeric,0);
  SELECT COALESCE(sum((r->>'amount')::numeric),0) INTO allocated FROM jsonb_array_elements(p_payload->'payments') r;
  IF fees IS DISTINCT FROM (SELECT COALESCE(sum(COALESCE((r->>'intermediary_commission')::numeric,0)+COALESCE((r->>'transfer_fee')::numeric,0)),0) FROM jsonb_array_elements(p_payload->'payments') r) THEN RAISE EXCEPTION 'رسوم التحصيل لا تطابق إجمالي الدفعة'; END IF;
  SELECT COALESCE(sum((r->>'amount')::numeric),0) INTO outflow FROM (
    SELECT value r FROM jsonb_array_elements(p_payload->'employees') UNION ALL
    SELECT value FROM jsonb_array_elements(p_payload->'custody') UNION ALL
    SELECT value FROM jsonb_array_elements(p_payload->'expenses')) destinations;
  IF allocated<>total OR fees<0 OR outflow+fees>total THEN RAISE EXCEPTION 'التوزيع غير متوازن أو يتجاوز الأموال المستلمة'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements((p_payload->'employees') || (p_payload->'custody') || (p_payload->'expenses') || (p_payload->'payments')) r
    WHERE (r->>'amount') IS NULL OR (r->>'amount')::numeric<=0 OR r->>'amount' IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'مبالغ التوزيع غير صالحة'; END IF;
  PERFORM 1 FROM customer_payments WHERE distributed_payment_id=group_id FOR UPDATE;
  SELECT array_agg(id::text ORDER BY id::text),jsonb_agg(to_jsonb(p)),COALESCE(sum(amount),0) INTO actual_ids,old_receipts,old_total
    FROM customer_payments p WHERE distributed_payment_id=group_id;
  SELECT array_agg(value ORDER BY value) INTO expected_ids FROM jsonb_array_elements_text(p_payload->'expected_payment_ids');
  IF COALESCE(actual_ids,'{}') <> COALESCE(expected_ids,'{}') THEN RAISE EXCEPTION 'تغيرت الدفعة منذ فتحها؛ أعد تحميلها قبل الحفظ'; END IF;
  IF EXISTS(SELECT 1 FROM customer_payments WHERE distributed_payment_id=group_id AND customer_id IS DISTINCT FROM customer) THEN RAISE EXCEPTION 'الدفعة تخص عميلًا آخر'; END IF;
  SELECT purchase_invoice_id INTO old_purchase FROM customer_payments WHERE distributed_payment_id=group_id AND purchase_invoice_id IS NOT NULL LIMIT 1;
  IF EXISTS(SELECT 1 FROM employee_advances a WHERE a.distributed_payment_id=group_id AND (a.remaining<>a.amount OR a.status='settled')) THEN
    RAISE EXCEPTION 'توجد سلفة تمت تسويتها؛ يجب مراجعة تسويتها قبل تعديل الدفعة';
  END IF;

  -- Keep existing custody history; only change its funding difference.
  FOR account IN SELECT * FROM custody_accounts WHERE source_payment_id=group_id AND source_type='distributed_payment' FOR UPDATE LOOP
    SELECT sum((r->>'amount')::numeric) INTO part FROM jsonb_array_elements(p_payload->'custody') r WHERE (r->>'employeeId')::uuid=account.employee_id;
    IF part IS NULL THEN
      IF EXISTS(SELECT 1 FROM custody_expenses WHERE custody_account_id=account.id) OR EXISTS(SELECT 1 FROM custody_transactions WHERE custody_account_id=account.id) THEN
        RAISE EXCEPTION 'لا يمكن إلغاء عهدة لها حركات؛ راجع تسوية العهدة أولًا';
      END IF;
      DELETE FROM custody_accounts WHERE id=account.id;
    ELSIF account.current_balance+part-account.initial_amount<0 THEN RAISE EXCEPTION 'مبلغ العهدة الجديد أقل من المبلغ المستخدم منها';
    END IF;
  END LOOP;
  UPDATE installation_team_accounts SET status='pending',distributed_payment_id=NULL WHERE distributed_payment_id=group_id;
  DELETE FROM customer_payments WHERE distributed_payment_id=group_id;
  DELETE FROM employee_advances WHERE distributed_payment_id=group_id;
  DELETE FROM expenses_withdrawals WHERE distributed_payment_id=group_id;
  DELETE FROM expense_payments WHERE distributed_payment_id=group_id;
  IF source_id IS NOT NULL THEN
    SELECT * INTO receipt FROM customer_payments WHERE id=source_id FOR UPDATE;
    IF NOT FOUND OR receipt.customer_id IS DISTINCT FROM customer OR receipt.distributed_payment_id IS NOT NULL
      OR receipt.contract_number IS NOT NULL OR receipt.printed_invoice_id IS NOT NULL OR receipt.sales_invoice_id IS NOT NULL OR receipt.composite_task_id IS NOT NULL
      OR receipt.amount<>total OR receipt.entry_type NOT IN ('payment','receipt','account_payment') THEN RAISE EXCEPTION 'رصيد الحساب الأصلي تغير أو غير متاح للتوزيع'; END IF;
    DELETE FROM customer_payments WHERE id=source_id;
  END IF;
  IF old_purchase IS NOT NULL THEN UPDATE purchase_invoices SET used_as_payment=GREATEST(0,COALESCE(used_as_payment,0)-old_total) WHERE id=old_purchase; END IF;
  IF new_purchase IS NOT NULL THEN
    SELECT total_amount-COALESCE(used_as_payment,0) INTO balance FROM purchase_invoices WHERE id=new_purchase AND customer_id=customer FOR UPDATE;
    IF NOT FOUND OR balance<total THEN RAISE EXCEPTION 'رصيد فاتورة المشتريات لا يكفي'; END IF;
    UPDATE purchase_invoices SET used_as_payment=COALESCE(used_as_payment,0)+total WHERE id=new_purchase;
  END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'payments') LOOP
    receipt := jsonb_populate_record(NULL::customer_payments,row);
    receipt.id := gen_random_uuid(); receipt.customer_id := customer; receipt.distributed_payment_id := group_id;
    receipt.entry_type := 'payment'; receipt.purchase_invoice_id := new_purchase; receipt.created_at := now(); receipt.updated_at := now();
    IF num_nonnulls(receipt.contract_number,receipt.printed_invoice_id,receipt.sales_invoice_id,receipt.composite_task_id)>1 THEN RAISE EXCEPTION 'حدد وجهة واحدة لكل تخصيص'; END IF;
    IF receipt.contract_number IS NOT NULL THEN
      SELECT "Total"::numeric INTO due FROM "Contract" WHERE "Contract_Number"=receipt.contract_number AND customer_id=customer FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'العقد غير متاح للعميل'; END IF;
      SELECT COALESCE(sum(amount),0) INTO already_paid FROM customer_payments WHERE contract_number=receipt.contract_number AND entry_type IN ('payment','receipt','account_payment');
    ELSIF receipt.printed_invoice_id IS NOT NULL THEN
      SELECT total_amount INTO due FROM printed_invoices WHERE id=receipt.printed_invoice_id AND customer_id=customer FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'فاتورة الطباعة غير متاحة'; END IF;
      SELECT COALESCE(sum(amount),0) INTO already_paid FROM customer_payments WHERE printed_invoice_id=receipt.printed_invoice_id AND entry_type IN ('payment','receipt','account_payment');
    ELSIF receipt.sales_invoice_id IS NOT NULL THEN
      SELECT total_amount INTO due FROM sales_invoices WHERE id=receipt.sales_invoice_id AND customer_id=customer FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'فاتورة المبيعات غير متاحة'; END IF;
      SELECT COALESCE(sum(amount),0) INTO already_paid FROM customer_payments WHERE sales_invoice_id=receipt.sales_invoice_id AND entry_type IN ('payment','receipt','account_payment');
    ELSIF receipt.composite_task_id IS NOT NULL THEN
      SELECT customer_total INTO due FROM composite_tasks WHERE id=receipt.composite_task_id AND customer_id=customer FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'المهمة غير متاحة'; END IF;
      SELECT COALESCE(sum(amount),0) INTO already_paid FROM customer_payments WHERE composite_task_id=receipt.composite_task_id AND entry_type IN ('payment','receipt','account_payment');
    ELSE due := total; already_paid := 0;
    END IF;
    IF receipt.amount>due-already_paid THEN RAISE EXCEPTION 'التخصيص يتجاوز المتبقي على العقد أو الفاتورة؛ حدّث البيانات'; END IF;
    INSERT INTO customer_payments SELECT receipt.*;
  END LOOP;
  -- Refresh both removed and newly allocated targets from their ledger entries.
  FOR row IN SELECT value FROM jsonb_array_elements(COALESCE(old_receipts,'[]') || (p_payload->'payments')) LOOP
    IF NULLIF(row->>'contract_number','') IS NOT NULL THEN
      UPDATE "Contract" c SET "Total Paid"=(SELECT COALESCE(sum(amount),0)::text FROM customer_payments p WHERE p.contract_number=c."Contract_Number" AND p.entry_type IN ('payment','receipt','account_payment')) WHERE c."Contract_Number"=(row->>'contract_number')::bigint;
    END IF;
    IF NULLIF(row->>'printed_invoice_id','') IS NOT NULL THEN
      SELECT COALESCE(sum(amount),0) INTO already_paid FROM customer_payments WHERE printed_invoice_id=(row->>'printed_invoice_id')::uuid AND entry_type IN ('payment','receipt','account_payment');
      UPDATE printed_invoices SET paid_amount=already_paid,paid=(already_paid>=total_amount) WHERE id=(row->>'printed_invoice_id')::uuid;
    END IF;
    IF NULLIF(row->>'sales_invoice_id','') IS NOT NULL THEN
      UPDATE sales_invoices i SET paid_amount=(SELECT COALESCE(sum(amount),0) FROM customer_payments p WHERE p.sales_invoice_id=i.id AND p.entry_type IN ('payment','receipt','account_payment')) WHERE i.id=(row->>'sales_invoice_id')::uuid;
    END IF;
    IF NULLIF(row->>'composite_task_id','') IS NOT NULL THEN
      UPDATE composite_tasks t SET paid_amount=(SELECT COALESCE(sum(amount),0) FROM customer_payments p WHERE p.composite_task_id=t.id AND p.entry_type IN ('payment','receipt','account_payment')) WHERE t.id=(row->>'composite_task_id')::uuid;
    END IF;
  END LOOP;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'employees') LOOP
    SELECT * INTO employee FROM employees WHERE id=(row->>'employeeId')::uuid AND status='active' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الموظف غير متاح'; END IF;
    part := (row->>'amount')::numeric;
    IF row->>'paymentType'='advance' THEN
      INSERT INTO employee_advances(employee_id,amount,remaining,reason,status,request_date,distributed_payment_id)
        VALUES(employee.id,part,part,'سلفة من دفعة موزعة - ' || (p_payload->>'customer_name'),'approved',(p_payload->>'date')::date,group_id);
    ELSIF row->>'paymentType'='from_balance' AND employee.installation_team_id IS NOT NULL THEN
      SELECT COALESCE(sum(amount),0) INTO balance FROM installation_team_accounts WHERE team_id=employee.installation_team_id AND status='pending';
      IF part>balance THEN RAISE EXCEPTION 'رصيد فريق التركيب لا يكفي'; END IF;
      remaining := part;
      FOR team_account IN SELECT * FROM installation_team_accounts WHERE team_id=employee.installation_team_id AND status='pending' ORDER BY installation_date,id FOR UPDATE LOOP
        EXIT WHEN remaining<=0;
        allocated := LEAST(remaining,team_account.amount);
        IF allocated<team_account.amount THEN
          INSERT INTO installation_team_accounts(team_id,task_item_id,billboard_id,contract_id,installation_date,amount,status,notes)
            VALUES(team_account.team_id,team_account.task_item_id,team_account.billboard_id,team_account.contract_id,team_account.installation_date,team_account.amount-allocated,'pending',team_account.notes);
        END IF;
        UPDATE installation_team_accounts SET amount=allocated,status='paid',distributed_payment_id=group_id WHERE id=team_account.id;
        remaining := remaining-allocated;
      END LOOP;
      IF remaining>0 THEN RAISE EXCEPTION 'تغير رصيد الفريق أثناء الحفظ؛ أعد تحميل البيانات'; END IF;
    ELSIF row->>'paymentType'='from_balance' AND employee.linked_to_operating_expenses THEN
      IF part>COALESCE(available_operating_balance(),0) THEN RAISE EXCEPTION 'رصيد مستحقات التشغيل لا يكفي'; END IF;
      INSERT INTO expenses_withdrawals(amount,date,type,method,note,receiver_name,sender_name,distributed_payment_id)
        VALUES(part,(p_payload->>'date')::date,'individual',p_payload->>'method','سحب من رصيد مستحقات التشغيل - دفعة ' || (p_payload->>'customer_name'),employee.name,NULLIF(p_payload->>'sender_name',''),group_id);
    ELSE RAISE EXCEPTION 'نوع سداد الموظف غير صالح؛ اختر سلفة أو مستحقات متاحة';
    END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'custody') r GROUP BY r->>'employeeId' HAVING count(*)>1) THEN RAISE EXCEPTION 'مستلم العهدة مكرر'; END IF;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'custody') LOOP
    part := (row->>'amount')::numeric;
    SELECT * INTO account FROM custody_accounts WHERE source_payment_id=group_id AND source_type='distributed_payment' AND employee_id=(row->>'employeeId')::uuid FOR UPDATE;
    IF FOUND THEN
      IF (SELECT count(*) FROM custody_accounts WHERE source_payment_id=group_id AND employee_id=account.employee_id)>1 THEN RAISE EXCEPTION 'توجد عهد مكررة لهذه الدفعة؛ راجعها قبل التعديل'; END IF;
      UPDATE custody_accounts SET initial_amount=part,current_balance=current_balance+part-initial_amount WHERE id=account.id;
    ELSE
      INSERT INTO custody_accounts(employee_id,account_number,initial_amount,current_balance,status,source_payment_id,source_type,assigned_date,notes)
        VALUES((row->>'employeeId')::uuid,'CUS-' || substr(gen_random_uuid()::text,1,12),part,part,'active',group_id,'distributed_payment',(p_payload->>'date')::date,'عهدة من دفعة ' || (p_payload->>'customer_name'));
    END IF;
  END LOOP;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'expenses') LOOP
    INSERT INTO expense_payments(expense_id,amount,paid_at,paid_via,payment_source,distributed_payment_id,notes)
      VALUES((row->>'expense_id')::uuid,(row->>'amount')::numeric,(p_payload->>'date')::timestamptz,'distributed_payment','distributed_payment:' || group_id,group_id,'سداد من دفعة ' || (p_payload->>'customer_name'));
  END LOOP;
  remaining := total;
  FOR row IN SELECT value FROM jsonb_array_elements(p_payload->'rentals') LOOP
    SELECT friend_rental_cost-COALESCE(used_as_payment,0) INTO balance FROM friend_billboard_rentals WHERE id=(row->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'إيجار اللوحة غير متاح'; END IF;
    part := LEAST(remaining,GREATEST(0,balance));
    UPDATE friend_billboard_rentals SET used_as_payment=COALESCE(used_as_payment,0)+part WHERE id=(row->>'id')::uuid;
    remaining := remaining-part;
  END LOOP;
  IF jsonb_array_length(p_payload->'rentals')>0 AND remaining>0 THEN RAISE EXCEPTION 'رصيد إيجار اللوحات لا يكفي'; END IF;
  INSERT INTO payment_distribution_requests(request_id,group_id,payload_hash) VALUES(p_request_id,group_id,md5(p_payload::text));
  RETURN group_id;
END $$;
REVOKE ALL ON FUNCTION public.save_payment_distribution(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_payment_distribution(uuid,jsonb) TO authenticated;
