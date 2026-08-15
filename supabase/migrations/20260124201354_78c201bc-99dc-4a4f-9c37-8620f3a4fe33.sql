-- إضافة أعمدة لنظام التسعير في جدول مهام التركيب
ALTER TABLE installation_task_items 
ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'piece' CHECK (pricing_type IN ('piece', 'meter')),
ADD COLUMN IF NOT EXISTS price_per_meter numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_installation_cost numeric DEFAULT 0;

-- إضافة عمود لتخزين نوع التسعير الافتراضي للمهمة
ALTER TABLE installation_tasks
ADD COLUMN IF NOT EXISTS default_pricing_type text DEFAULT 'piece' CHECK (default_pricing_type IN ('piece', 'meter')),
ADD COLUMN IF NOT EXISTS default_price_per_meter numeric DEFAULT 0;

COMMENT ON COLUMN installation_task_items.pricing_type IS 'نوع التسعير: piece = بالقطعة، meter = بالمتر';
COMMENT ON COLUMN installation_task_items.price_per_meter IS 'السعر لكل متر مربع';
COMMENT ON COLUMN installation_task_items.company_installation_cost IS 'تكلفة التركيب للشركة (قابلة للتعديل)';
COMMENT ON COLUMN installation_tasks.default_pricing_type IS 'نوع التسعير الافتراضي للمهمة';
COMMENT ON COLUMN installation_tasks.default_price_per_meter IS 'السعر الافتراضي لكل متر مربع';