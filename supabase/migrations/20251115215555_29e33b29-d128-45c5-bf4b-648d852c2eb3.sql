-- إضافة حقول جديدة لمهمات الطباعة
ALTER TABLE print_tasks ADD COLUMN IF NOT EXISTS price_per_meter NUMERIC DEFAULT 0;
ALTER TABLE print_tasks ADD COLUMN IF NOT EXISTS has_cutouts BOOLEAN DEFAULT false;
ALTER TABLE print_tasks ADD COLUMN IF NOT EXISTS cutout_quantity INTEGER DEFAULT 0;
ALTER TABLE print_tasks ADD COLUMN IF NOT EXISTS cutout_cost NUMERIC DEFAULT 0;

-- إضافة حقل للوحات لتحديد إذا كانت بها مجسم
ALTER TABLE billboards ADD COLUMN IF NOT EXISTS has_cutout BOOLEAN DEFAULT false;

-- إضافة حقل في مهمات التركيب للوحات
ALTER TABLE installation_task_items ADD COLUMN IF NOT EXISTS has_cutout BOOLEAN DEFAULT false;

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN print_tasks.price_per_meter IS 'سعر المتر لمهمة الطباعة';
COMMENT ON COLUMN print_tasks.has_cutouts IS 'هل تحتوي مهمة الطباعة على قص مجسمات';
COMMENT ON COLUMN print_tasks.cutout_quantity IS 'عدد المجسمات المطلوب قصها';
COMMENT ON COLUMN print_tasks.cutout_cost IS 'تكلفة قص المجسمات';
COMMENT ON COLUMN billboards.has_cutout IS 'هل اللوحة تحتوي على مجسم بارز';
COMMENT ON COLUMN installation_task_items.has_cutout IS 'هل اللوحة في مهمة التركيب تحتوي على مجسم';