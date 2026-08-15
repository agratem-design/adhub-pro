-- إضافة عمود نوع المهمة لجدول مهام التركيب
ALTER TABLE installation_tasks 
ADD COLUMN IF NOT EXISTS task_type text DEFAULT 'installation';

-- تحديث المهام الحالية
UPDATE installation_tasks 
SET task_type = 'installation' 
WHERE task_type IS NULL;