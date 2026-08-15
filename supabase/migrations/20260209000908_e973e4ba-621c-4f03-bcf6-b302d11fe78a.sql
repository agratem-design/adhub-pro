-- تعديل قيد المفتاح الأجنبي في جدول pricing ليدعم التحديث التلقائي
ALTER TABLE pricing DROP CONSTRAINT IF EXISTS fk_pricing_size_name;

ALTER TABLE pricing 
ADD CONSTRAINT fk_pricing_size_name 
FOREIGN KEY (size) 
REFERENCES sizes(name) 
ON UPDATE CASCADE 
ON DELETE SET NULL;