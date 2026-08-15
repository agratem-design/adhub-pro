-- إضافة عمود لربط مهمة التركيب بمهمة الطباعة
ALTER TABLE installation_tasks 
ADD COLUMN IF NOT EXISTS print_task_id uuid REFERENCES print_tasks(id) ON DELETE SET NULL;

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_installation_tasks_print_task_id 
ON installation_tasks(print_task_id) WHERE print_task_id IS NOT NULL;