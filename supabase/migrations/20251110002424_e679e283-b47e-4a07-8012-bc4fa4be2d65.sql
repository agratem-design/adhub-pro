-- إضافة عمود صورة التركيب لمهام الإزالة
ALTER TABLE removal_task_items 
ADD COLUMN IF NOT EXISTS installed_image_url text;