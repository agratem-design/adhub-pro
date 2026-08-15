-- إضافة أعمدة جديدة لجدول print_tasks
ALTER TABLE print_tasks 
ADD COLUMN IF NOT EXISTS cutout_printer_id UUID REFERENCES printers(id),
ADD COLUMN IF NOT EXISTS cutout_image_url TEXT;

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN print_tasks.cutout_printer_id IS 'معرف مطبعة المجسمات المكلفة بقص المجسمات';
COMMENT ON COLUMN print_tasks.cutout_image_url IS 'رابط صورة المجسم المطلوب قصه';