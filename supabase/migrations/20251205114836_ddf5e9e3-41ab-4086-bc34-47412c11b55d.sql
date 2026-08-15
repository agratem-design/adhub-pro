-- إنشاء دالة لتحديث تكلفة التركيب في المهمة المجمعة من عناصر التركيب
CREATE OR REPLACE FUNCTION public.sync_composite_task_installation_cost()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_installation_task_id uuid;
  v_total_customer_cost numeric;
BEGIN
  -- الحصول على معرف مهمة التركيب
  v_installation_task_id := COALESCE(NEW.task_id, OLD.task_id);
  
  -- حساب إجمالي تكلفة الزبون من جميع عناصر التركيب
  SELECT COALESCE(SUM(customer_installation_cost), 0)
  INTO v_total_customer_cost
  FROM installation_task_items
  WHERE task_id = v_installation_task_id;
  
  -- تحديث المهمة المجمعة المرتبطة
  UPDATE composite_tasks
  SET customer_installation_cost = v_total_customer_cost,
      updated_at = now()
  WHERE installation_task_id = v_installation_task_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- إنشاء trigger على عناصر التركيب
DROP TRIGGER IF EXISTS sync_composite_task_cost_on_item_change ON installation_task_items;

CREATE TRIGGER sync_composite_task_cost_on_item_change
AFTER INSERT OR UPDATE OF customer_installation_cost OR DELETE
ON installation_task_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_composite_task_installation_cost();

-- تحديث المهام المجمعة الحالية لتكون متزامنة
UPDATE composite_tasks ct
SET customer_installation_cost = (
  SELECT COALESCE(SUM(iti.customer_installation_cost), ct.customer_installation_cost)
  FROM installation_task_items iti
  WHERE iti.task_id = ct.installation_task_id
)
WHERE EXISTS (
  SELECT 1 FROM installation_task_items iti
  WHERE iti.task_id = ct.installation_task_id
  AND iti.customer_installation_cost > 0
);