-- إضافة عمود رقم العقد السابق للعقود المجددة
ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS previous_contract_number integer;

-- إضافة تعليق
COMMENT ON COLUMN public."Contract".previous_contract_number IS 'رقم العقد السابق في حالة التجديد';