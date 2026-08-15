-- حذف مهام التركيب وعناصرها قبل أكتوبر 2025
-- أولاً: حذف عناصر المهام المرتبطة بالمهام القديمة
DELETE FROM installation_task_items
WHERE task_id IN (
  SELECT id FROM installation_tasks
  WHERE created_at < '2025-10-01'::date
);

-- ثانياً: حذف المهام القديمة نفسها
DELETE FROM installation_tasks
WHERE created_at < '2025-10-01'::date;