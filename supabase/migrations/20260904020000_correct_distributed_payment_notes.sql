-- Keep each allocation note consistent with the restored 13,000 LYD receipt.
UPDATE customer_payments
SET
  notes = 'توزيع على عقد #' || contract_number || ' من دفعة بمبلغ 13000.00 د.ل',
  updated_at = now()
WHERE distributed_payment_id = 'dist-1786801294667-h3q7z6v7z'
  AND contract_number IS NOT NULL
  AND notes IS DISTINCT FROM ('توزيع على عقد #' || contract_number || ' من دفعة بمبلغ 13000.00 د.ل');
