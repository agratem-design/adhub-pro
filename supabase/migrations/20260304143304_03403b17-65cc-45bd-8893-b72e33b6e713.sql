
-- Trigger: عند تغيير customer_installation_cost في installation_task_items
-- يتم تحديث composite_tasks.customer_installation_cost تلقائياً من مجموع العناصر
CREATE OR REPLACE FUNCTION public.sync_installation_items_to_composite()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_composite_id uuid;
  v_new_total numeric;
BEGIN
  -- ابحث عن المهمة المجمعة المرتبطة
  SELECT ct.id INTO v_composite_id
  FROM composite_tasks ct
  WHERE ct.installation_task_id = (
    SELECT task_id FROM installation_task_items WHERE id = COALESCE(NEW.id, OLD.id) LIMIT 1
  );

  IF v_composite_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- احسب المجموع الجديد من كل العناصر
  SELECT COALESCE(SUM(iti.customer_installation_cost), 0) INTO v_new_total
  FROM installation_task_items iti
  JOIN installation_tasks it ON iti.task_id = it.id
  JOIN composite_tasks ct ON ct.installation_task_id = it.id
  WHERE ct.id = v_composite_id;

  -- حدّث المهمة المجمعة (trigger calculate_composite_task_profit سيحسب customer_total تلقائياً)
  UPDATE composite_tasks
  SET customer_installation_cost = v_new_total
  WHERE id = v_composite_id
    AND customer_installation_cost IS DISTINCT FROM v_new_total;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ربط الدالة بجدول installation_task_items
DROP TRIGGER IF EXISTS trg_sync_install_items_to_composite ON installation_task_items;
CREATE TRIGGER trg_sync_install_items_to_composite
AFTER INSERT OR UPDATE OF customer_installation_cost OR DELETE
ON installation_task_items
FOR EACH ROW
EXECUTE FUNCTION sync_installation_items_to_composite();
