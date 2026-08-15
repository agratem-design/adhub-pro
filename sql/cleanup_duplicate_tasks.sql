-- حذف المهام المكررة والاحتفاظ بأحدث مهمة لكل عقد وفريق

-- أولاً: حذف عناصر المهام المكررة
DELETE FROM installation_task_items
WHERE task_id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY contract_id, team_id 
        ORDER BY created_at DESC
      ) as rn
    FROM installation_tasks
  ) duplicates
  WHERE rn > 1
);

-- ثانياً: حذف المهام المكررة نفسها
DELETE FROM installation_tasks
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY contract_id, team_id 
        ORDER BY created_at DESC
      ) as rn
    FROM installation_tasks
  ) duplicates
  WHERE rn > 1
);

-- عرض النتائج بعد الحذف
SELECT 
  contract_id,
  team_id,
  COUNT(*) as tasks_count,
  ARRAY_AGG(id) as task_ids
FROM installation_tasks
WHERE contract_id >= 1130
GROUP BY contract_id, team_id
HAVING COUNT(*) > 1
ORDER BY contract_id, team_id;
