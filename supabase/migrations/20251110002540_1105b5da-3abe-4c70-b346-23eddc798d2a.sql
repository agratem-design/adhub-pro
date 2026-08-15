-- إضافة أعمدة التصاميم لجدول removal_task_items إذا لم تكن موجودة
ALTER TABLE removal_task_items 
ADD COLUMN IF NOT EXISTS design_face_a text,
ADD COLUMN IF NOT EXISTS design_face_b text;

-- تحديث مهام الإزالة الموجودة بالفعل بنسخ التصاميم وصور التركيب من مهام التركيب
UPDATE removal_task_items rti
SET 
  design_face_a = COALESCE(rti.design_face_a, iti.design_face_a),
  design_face_b = COALESCE(rti.design_face_b, iti.design_face_b),
  installed_image_url = COALESCE(rti.installed_image_url, iti.installed_image_url)
FROM (
  SELECT DISTINCT ON (billboard_id)
    billboard_id,
    design_face_a,
    design_face_b,
    installed_image_url
  FROM installation_task_items
  WHERE design_face_a IS NOT NULL 
    OR design_face_b IS NOT NULL 
    OR installed_image_url IS NOT NULL
  ORDER BY billboard_id, created_at DESC
) iti
WHERE rti.billboard_id = iti.billboard_id
  AND (
    rti.design_face_a IS NULL 
    OR rti.design_face_b IS NULL 
    OR rti.installed_image_url IS NULL
  );