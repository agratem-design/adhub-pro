-- إضافة عمود التكاليف الإضافية لعناصر مهام التركيب
ALTER TABLE public.installation_task_items 
ADD COLUMN IF NOT EXISTS additional_cost numeric DEFAULT 0;

-- إضافة عمود ملاحظات التكاليف الإضافية
ALTER TABLE public.installation_task_items 
ADD COLUMN IF NOT EXISTS additional_cost_notes text;

-- تعليق على العمود
COMMENT ON COLUMN public.installation_task_items.additional_cost IS 'تكاليف إضافية للوحة (تضاف لتكلفة الفريق)';