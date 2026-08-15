-- إنشاء دالة لمزامنة تكاليف القص مع المهام المجمعة
CREATE OR REPLACE FUNCTION sync_cutout_costs_to_composite()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث composite_task المرتبطة بمهمة القص
  UPDATE composite_tasks
  SET 
    company_cutout_cost = NEW.total_cost,
    customer_cutout_cost = NEW.customer_total_amount,
    company_total = COALESCE(company_installation_cost, 0) + COALESCE(company_print_cost, 0) + COALESCE(NEW.total_cost, 0),
    customer_total = COALESCE(customer_installation_cost, 0) + COALESCE(customer_print_cost, 0) + COALESCE(NEW.customer_total_amount, 0) - COALESCE(discount_amount, 0),
    net_profit = (COALESCE(customer_installation_cost, 0) + COALESCE(customer_print_cost, 0) + COALESCE(NEW.customer_total_amount, 0) - COALESCE(discount_amount, 0))
               - (COALESCE(company_installation_cost, 0) + COALESCE(company_print_cost, 0) + COALESCE(NEW.total_cost, 0)),
    updated_at = now()
  WHERE cutout_task_id = NEW.id;
  
  -- إعادة حساب نسبة الربح
  UPDATE composite_tasks
  SET profit_percentage = CASE 
      WHEN customer_total > 0 THEN (net_profit / customer_total) * 100 
      ELSE 0 
    END
  WHERE cutout_task_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger على جدول cutout_tasks
DROP TRIGGER IF EXISTS sync_cutout_to_composite_trigger ON cutout_tasks;
CREATE TRIGGER sync_cutout_to_composite_trigger
AFTER UPDATE OF total_cost, customer_total_amount ON cutout_tasks
FOR EACH ROW
WHEN (OLD.total_cost IS DISTINCT FROM NEW.total_cost 
   OR OLD.customer_total_amount IS DISTINCT FROM NEW.customer_total_amount)
EXECUTE FUNCTION sync_cutout_costs_to_composite();