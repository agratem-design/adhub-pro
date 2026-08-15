-- تعديل قيد المفتاح الأجنبي ليدعم التحديث والحذف التلقائي
-- أولاً: حذف القيد القديم
ALTER TABLE billboards DROP CONSTRAINT IF EXISTS fk_billboard_size_name;

-- ثانياً: إعادة إنشاء القيد مع ON UPDATE CASCADE
ALTER TABLE billboards 
ADD CONSTRAINT fk_billboard_size_name 
FOREIGN KEY ("Size") 
REFERENCES sizes(name) 
ON UPDATE CASCADE 
ON DELETE SET NULL;