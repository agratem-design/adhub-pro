-- إزالة constraint القديم وإضافة واحد جديد يشمل جميع الأنواع
ALTER TABLE customer_payments 
DROP CONSTRAINT IF EXISTS customer_payments_entry_type_check;

-- إضافة constraint جديد يشمل جميع أنواع الدفعات المطلوبة
ALTER TABLE customer_payments 
ADD CONSTRAINT customer_payments_entry_type_check 
CHECK (entry_type = ANY (ARRAY[
  'payment'::text,
  'debt'::text, 
  'receipt'::text,
  'invoice'::text,
  'account_payment'::text,
  'purchase_invoice'::text,
  'sales_invoice'::text,
  'printed_invoice'::text,
  'general_debit'::text,
  'general_credit'::text
]));