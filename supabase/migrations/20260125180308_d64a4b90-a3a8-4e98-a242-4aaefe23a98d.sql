
-- إضافة عمود "مضمنة في العقد" لفواتير الطباعة
ALTER TABLE printed_invoices 
ADD COLUMN IF NOT EXISTS included_in_contract boolean DEFAULT false;

-- تعليق توضيحي
COMMENT ON COLUMN printed_invoices.included_in_contract IS 'فاتورة مضمنة في العقد - لا تضاف لإجمالي الديون';
