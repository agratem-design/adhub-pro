-- إضافة حقول التصاميم إلى جدول installation_task_items
ALTER TABLE installation_task_items 
ADD COLUMN IF NOT EXISTS design_face_a text,
ADD COLUMN IF NOT EXISTS design_face_b text;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_installation_task_items_task_id 
ON installation_task_items(task_id);

-- تحديث تعليق الجدول
COMMENT ON COLUMN installation_task_items.design_face_a IS 'رابط تصميم الوجه الأمامي للإعلان';
COMMENT ON COLUMN installation_task_items.design_face_b IS 'رابط تصميم الوجه الخلفي للإعلان';