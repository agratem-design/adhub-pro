-- إضافة عمود cutout_image_url لجدول print_task_items لحفظ صورة المجسم لكل تصميم
ALTER TABLE print_task_items 
ADD COLUMN IF NOT EXISTS cutout_image_url TEXT;

COMMENT ON COLUMN print_task_items.cutout_image_url IS 'رابط صورة المجسم الخاص بهذا التصميم';