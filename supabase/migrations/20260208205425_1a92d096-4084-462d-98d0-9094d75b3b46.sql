-- إضافة تسلسل تلقائي لعمود id في جدول sizes
CREATE SEQUENCE IF NOT EXISTS sizes_id_seq;

-- تعيين القيمة الحالية للتسلسل
SELECT setval('sizes_id_seq', COALESCE((SELECT MAX(id) FROM sizes), 0) + 1);

-- تعيين القيمة الافتراضية لعمود id
ALTER TABLE sizes ALTER COLUMN id SET DEFAULT nextval('sizes_id_seq');