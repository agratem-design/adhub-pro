-- إضافة عمود installation_task_id إلى جدول print_tasks
ALTER TABLE print_tasks 
ADD COLUMN IF NOT EXISTS installation_task_id uuid REFERENCES installation_tasks(id) ON DELETE SET NULL;

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_print_tasks_installation_task_id 
ON print_tasks(installation_task_id);