-- إضافة حقول التصاميم لكل لوحة في جدول billboards
ALTER TABLE billboards 
ADD COLUMN IF NOT EXISTS design_face_a text,
ADD COLUMN IF NOT EXISTS design_face_b text;

COMMENT ON COLUMN billboards.design_face_a IS 'مسار تصميم الوجه الأمامي للوحة';
COMMENT ON COLUMN billboards.design_face_b IS 'مسار تصميم الوجه الخلفي للوحة';