-- إضافة حقل تكلفة التركيب للزبون في جدول installation_task_items
ALTER TABLE public.installation_task_items
ADD COLUMN IF NOT EXISTS customer_installation_cost numeric DEFAULT 0;

COMMENT ON COLUMN public.installation_task_items.customer_installation_cost IS 'تكلفة التركيب التي سيتم تحصيلها من الزبون';

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_installation_task_items_customer_cost 
ON public.installation_task_items(customer_installation_cost);