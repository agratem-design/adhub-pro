-- إضافة حقل تكلفة المطبعة إلى جدول فواتير الطباعة
ALTER TABLE printed_invoices
ADD COLUMN IF NOT EXISTS printer_cost numeric DEFAULT 0;

-- إضافة تعليق على الحقل
COMMENT ON COLUMN printed_invoices.printer_cost IS 'تكلفة الطباعة من المطبعة (سعر التكلفة)';