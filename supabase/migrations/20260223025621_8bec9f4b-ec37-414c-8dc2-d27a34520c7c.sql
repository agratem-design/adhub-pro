-- إضافة حقول التكلفة الإضافية على الشركة
ALTER TABLE public.installation_task_items
ADD COLUMN IF NOT EXISTS company_additional_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_additional_cost_notes text;