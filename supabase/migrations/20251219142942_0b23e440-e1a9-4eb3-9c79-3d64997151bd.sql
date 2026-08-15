-- حذف المهام المكررة (الإبقاء على الأحدث لكل contract_id + installation_task_id)
DELETE FROM composite_tasks 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY contract_id, installation_task_id ORDER BY created_at DESC) as rn
    FROM composite_tasks
    WHERE installation_task_id IS NOT NULL
  ) t WHERE rn > 1
);

-- إضافة قيد لمنع التكرار مستقبلاً
CREATE UNIQUE INDEX IF NOT EXISTS unique_composite_task_installation 
ON composite_tasks (contract_id, installation_task_id) 
WHERE installation_task_id IS NOT NULL;