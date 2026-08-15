-- إضافة عمود لتخزين رابط صورة اللوحة بعد التركيب
ALTER TABLE installation_task_items
ADD COLUMN installed_image_url text;

-- إضافة تعليق توضيحي للعمود الجديد
COMMENT ON COLUMN installation_task_items.installed_image_url IS 'رابط صورة اللوحة بعد التركيب - تستخدم في التقارير المطبوعة';