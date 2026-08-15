-- Add installation image fields for both faces to installation_task_items
ALTER TABLE installation_task_items 
ADD COLUMN IF NOT EXISTS installed_image_face_a_url text,
ADD COLUMN IF NOT EXISTS installed_image_face_b_url text;

COMMENT ON COLUMN installation_task_items.installed_image_face_a_url IS 'صورة التركيب للوجه الأمامي';
COMMENT ON COLUMN installation_task_items.installed_image_face_b_url IS 'صورة التركيب للوجه الخلفي';