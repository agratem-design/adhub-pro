-- إضافة حقول مرجعية لربط الدفعات بأنواع الفواتير المختلفة
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS printed_invoice_id uuid REFERENCES printed_invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sales_invoice_id uuid REFERENCES sales_invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS purchase_invoice_id uuid REFERENCES purchase_invoices(id) ON DELETE SET NULL;

-- إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_customer_payments_printed_invoice 
ON customer_payments(printed_invoice_id) WHERE printed_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_payments_sales_invoice 
ON customer_payments(sales_invoice_id) WHERE sales_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_payments_purchase_invoice 
ON customer_payments(purchase_invoice_id) WHERE purchase_invoice_id IS NOT NULL;

-- إضافة حقل لتتبع المبلغ المدفوع في فواتير المبيعات
ALTER TABLE sales_invoices 
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric GENERATED ALWAYS AS (total_amount - COALESCE(paid_amount, 0)) STORED;

-- إضافة حقل لتتبع المبلغ المستخدم من فواتير المشتريات كدفعات
ALTER TABLE purchase_invoices
ADD COLUMN IF NOT EXISTS used_as_payment numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_credit numeric GENERATED ALWAYS AS (total_amount - COALESCE(used_as_payment, 0)) STORED;

-- تحديث نوع entry_type ليشمل أنواع جديدة
COMMENT ON COLUMN customer_payments.entry_type IS 'receipt: إيصال دفع عادي, invoice: فاتورة عامة, debt: دين, account_payment: دفعة حساب عام, sales_invoice: فاتورة مبيعات, purchase_invoice: فاتورة مشتريات (كدفعة/مقايضة), printed_invoice: فاتورة طباعة';

-- إنشاء view لعرض ملخص مالي شامل للزبون
CREATE OR REPLACE VIEW customer_financial_summary AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  -- إجمالي العقود
  COALESCE(SUM(DISTINCT ct."Total"), 0) as total_contracts,
  -- إجمالي فواتير الطباعة
  COALESCE(SUM(DISTINCT pi.total_amount), 0) as total_printed_invoices,
  -- إجمالي فواتير المبيعات
  COALESCE(SUM(DISTINCT si.total_amount), 0) as total_sales_invoices,
  -- إجمالي المشتريات (كخصم محتمل)
  COALESCE(SUM(DISTINCT pui.total_amount), 0) as total_purchases,
  -- إجمالي المبلغ المستحق (الإيرادات)
  (COALESCE(SUM(DISTINCT ct."Total"), 0) + 
   COALESCE(SUM(DISTINCT pi.total_amount), 0) + 
   COALESCE(SUM(DISTINCT si.total_amount), 0)) as total_due,
  -- إجمالي المدفوعات
  COALESCE(
    (SELECT SUM(amount) 
     FROM customer_payments cp 
     WHERE cp.customer_id = c.id 
     AND cp.entry_type IN ('receipt', 'account_payment')), 0
  ) as total_paid,
  -- الرصيد المتبقي
  (COALESCE(SUM(DISTINCT ct."Total"), 0) + 
   COALESCE(SUM(DISTINCT pi.total_amount), 0) + 
   COALESCE(SUM(DISTINCT si.total_amount), 0) -
   COALESCE(
     (SELECT SUM(amount) 
      FROM customer_payments cp 
      WHERE cp.customer_id = c.id 
      AND cp.entry_type IN ('receipt', 'account_payment')), 0
   )) as balance
FROM customers c
LEFT JOIN "Contract" ct ON ct.customer_id = c.id
LEFT JOIN printed_invoices pi ON pi.customer_id = c.id AND pi.locked = false
LEFT JOIN sales_invoices si ON si.customer_id = c.id
LEFT JOIN purchase_invoices pui ON pui.customer_id = c.id
GROUP BY c.id, c.name;

-- منح صلاحيات للـ view
GRANT SELECT ON customer_financial_summary TO authenticated, anon;