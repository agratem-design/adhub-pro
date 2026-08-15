-- تحسين جدول composite_tasks لحساب التكاليف والأرباح بدقة

-- إضافة أعمدة جديدة للتكاليف التفصيلية
ALTER TABLE composite_tasks
ADD COLUMN IF NOT EXISTS customer_installation_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_installation_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_print_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_print_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_cutout_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_cutout_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS net_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_percentage NUMERIC DEFAULT 0;

-- إضافة أعمدة للتفاصيل
ALTER TABLE composite_tasks
ADD COLUMN IF NOT EXISTS invoice_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invoice_date DATE;

-- تحديث الأعمدة القديمة لتكون متوافقة (optional - للبيانات القديمة)
UPDATE composite_tasks
SET 
  customer_installation_cost = COALESCE(installation_cost, 0),
  customer_print_cost = COALESCE(print_cost, 0),
  customer_cutout_cost = COALESCE(cutout_cost, 0),
  customer_total = COALESCE(total_cost, 0)
WHERE customer_installation_cost = 0 AND customer_print_cost = 0 AND customer_cutout_cost = 0;

-- إنشاء دالة لحساب صافي الربح تلقائياً
CREATE OR REPLACE FUNCTION calculate_composite_task_profit()
RETURNS TRIGGER AS $$
BEGIN
  -- حساب الإجماليات
  NEW.customer_total := COALESCE(NEW.customer_installation_cost, 0) + 
                        COALESCE(NEW.customer_print_cost, 0) + 
                        COALESCE(NEW.customer_cutout_cost, 0);
  
  NEW.company_total := COALESCE(NEW.company_installation_cost, 0) + 
                       COALESCE(NEW.company_print_cost, 0) + 
                       COALESCE(NEW.company_cutout_cost, 0);
  
  -- حساب صافي الربح
  NEW.net_profit := NEW.customer_total - NEW.company_total;
  
  -- حساب نسبة الربح
  IF NEW.customer_total > 0 THEN
    NEW.profit_percentage := (NEW.net_profit / NEW.customer_total) * 100;
  ELSE
    NEW.profit_percentage := 0;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول composite_tasks
DROP TRIGGER IF EXISTS trigger_calculate_composite_profit ON composite_tasks;
CREATE TRIGGER trigger_calculate_composite_profit
BEFORE INSERT OR UPDATE ON composite_tasks
FOR EACH ROW
EXECUTE FUNCTION calculate_composite_task_profit();

-- دالة لإنشاء composite_task تلقائياً عند إنشاء installation_task
CREATE OR REPLACE FUNCTION auto_create_composite_task()
RETURNS TRIGGER AS $$
DECLARE
  v_contract RECORD;
  v_installation_cost_for_customer NUMERIC := 0;
  v_installation_cost_for_company NUMERIC := 0;
BEGIN
  -- جلب بيانات العقد
  SELECT 
    "Contract_Number",
    "Customer Name",
    customer_id,
    installation_enabled,
    installation_cost
  INTO v_contract
  FROM "Contract"
  WHERE "Contract_Number" = NEW.contract_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  -- حساب تكلفة التركيب
  -- للتركيب الجديد: مجاني للزبون (جزء من العقد)
  -- لإعادة التركيب: يحسب على الزبون
  IF v_contract.installation_enabled THEN
    v_installation_cost_for_customer := 0; -- مجاني للزبون في التركيب الأول
  END IF;
  
  -- التكلفة الفعلية للشركة تحسب من جدول installation_print_pricing
  v_installation_cost_for_company := COALESCE(v_contract.installation_cost, 0);
  
  -- إنشاء composite_task
  INSERT INTO composite_tasks (
    installation_task_id,
    contract_id,
    customer_id,
    customer_name,
    task_type,
    customer_installation_cost,
    company_installation_cost,
    customer_print_cost,
    company_print_cost,
    customer_cutout_cost,
    company_cutout_cost,
    status
  ) VALUES (
    NEW.id,
    NEW.contract_id,
    v_contract.customer_id,
    v_contract."Customer Name",
    'new_installation',
    v_installation_cost_for_customer,
    v_installation_cost_for_company,
    0,
    0,
    0,
    0,
    'pending'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول installation_tasks
DROP TRIGGER IF EXISTS trigger_auto_create_composite_task ON installation_tasks;
CREATE TRIGGER trigger_auto_create_composite_task
AFTER INSERT ON installation_tasks
FOR EACH ROW
EXECUTE FUNCTION auto_create_composite_task();

-- دالة لتحديث composite_task عند ربط print_task أو cutout_task
CREATE OR REPLACE FUNCTION update_composite_task_on_task_link()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث print_task_id في composite_tasks
  IF NEW.print_task_id IS NOT NULL AND OLD.print_task_id IS DISTINCT FROM NEW.print_task_id THEN
    UPDATE composite_tasks
    SET print_task_id = NEW.print_task_id
    WHERE installation_task_id = NEW.id;
  END IF;
  
  -- تحديث cutout_task_id في composite_tasks
  IF NEW.cutout_task_id IS NOT NULL AND OLD.cutout_task_id IS DISTINCT FROM NEW.cutout_task_id THEN
    UPDATE composite_tasks
    SET cutout_task_id = NEW.cutout_task_id
    WHERE installation_task_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول installation_tasks
DROP TRIGGER IF EXISTS trigger_update_composite_on_link ON installation_tasks;
CREATE TRIGGER trigger_update_composite_on_link
AFTER UPDATE ON installation_tasks
FOR EACH ROW
WHEN (NEW.print_task_id IS DISTINCT FROM OLD.print_task_id OR NEW.cutout_task_id IS DISTINCT FROM OLD.cutout_task_id)
EXECUTE FUNCTION update_composite_task_on_task_link();

-- دالة لحذف composite_task عند حذف installation_task
CREATE OR REPLACE FUNCTION delete_composite_task_on_installation_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM composite_tasks WHERE installation_task_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ربط الدالة بجدول installation_tasks
DROP TRIGGER IF EXISTS trigger_delete_composite_on_installation_delete ON installation_tasks;
CREATE TRIGGER trigger_delete_composite_on_installation_delete
AFTER DELETE ON installation_tasks
FOR EACH ROW
EXECUTE FUNCTION delete_composite_task_on_installation_delete();