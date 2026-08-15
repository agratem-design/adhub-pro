
-- أرشفة صور التركيب للوحات التي أُعيد تركيبها قبل إضافة الميزة
INSERT INTO installation_photo_history (task_item_id, billboard_id, task_id, reinstall_number, installed_image_face_a_url, installed_image_face_b_url, installation_date, notes)
SELECT 
  iti.id,
  iti.billboard_id,
  iti.task_id,
  COALESCE(iti.reinstall_count, 1),
  iti.installed_image_face_a_url,
  iti.installed_image_face_b_url,
  iti.installation_date,
  'أرشفة تلقائية - صور تركيب سابقة'
FROM installation_task_items iti
WHERE iti.replacement_status = 'reinstalled'
  AND (iti.installed_image_face_a_url IS NOT NULL OR iti.installed_image_face_b_url IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM installation_photo_history iph 
    WHERE iph.task_item_id = iti.id
  );
