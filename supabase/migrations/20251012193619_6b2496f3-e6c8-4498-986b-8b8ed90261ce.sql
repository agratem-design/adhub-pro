-- إضافة أعمدة روابط التصميم للعقود
ALTER TABLE "Contract" 
ADD COLUMN IF NOT EXISTS design_face_a_path TEXT,
ADD COLUMN IF NOT EXISTS design_face_b_path TEXT;