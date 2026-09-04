-- Restore the unallocated part of the 13,000 LYD receipt.
-- The two contract allocations total 10,850 LYD; the remaining 2,150 LYD is
-- customer credit and must not be recorded as an operating withdrawal.
DO $$
DECLARE
  v_distribution_id constant text := 'dist-1786801294667-h3q7z6v7z';
  v_expected_total constant numeric := 13000;
  v_allocated_total constant numeric := 10850;
  v_current_total numeric;
  v_credit customer_payments%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('restore-distributed-payment-credit:' || v_distribution_id));

  PERFORM 1
  FROM customer_payments
  WHERE distributed_payment_id = v_distribution_id
  FOR UPDATE;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_current_total
  FROM customer_payments
  WHERE distributed_payment_id = v_distribution_id;

  IF v_current_total = v_expected_total THEN
    RETURN;
  END IF;

  IF v_current_total <> v_allocated_total THEN
    RAISE EXCEPTION
      'Distribution % has total %, expected % before correction',
      v_distribution_id, v_current_total, v_allocated_total;
  END IF;

  SELECT *
  INTO v_credit
  FROM customer_payments
  WHERE distributed_payment_id = v_distribution_id
  ORDER BY created_at, id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Distribution % was not found', v_distribution_id;
  END IF;

  v_credit.id := gen_random_uuid();
  v_credit.amount := v_expected_total - v_allocated_total;
  v_credit.net_amount := v_expected_total - v_allocated_total;
  v_credit.contract_number := NULL;
  v_credit.printed_invoice_id := NULL;
  v_credit.sales_invoice_id := NULL;
  v_credit.composite_task_id := NULL;
  v_credit.purchase_invoice_id := NULL;
  v_credit.entry_type := 'payment';
  v_credit.transfer_fee := 0;
  v_credit.intermediary_commission := 0;
  v_credit.notes := 'رصيد عميل غير موزع من دفعة بقيمة 13,000 د.ل';
  v_credit.created_at := now();
  v_credit.updated_at := now();

  INSERT INTO customer_payments SELECT v_credit.*;
END
$$;
