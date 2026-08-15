-- إضافة أعمدة الدفع لجدول printed_invoices
ALTER TABLE printed_invoices 
ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone DEFAULT NULL;

-- إضافة تعليق على الأعمدة
COMMENT ON COLUMN printed_invoices.paid IS 'هل تم الدفع بالكامل';
COMMENT ON COLUMN printed_invoices.paid_amount IS 'المبلغ المدفوع من الفاتورة';
COMMENT ON COLUMN printed_invoices.paid_at IS 'تاريخ آخر دفعة';