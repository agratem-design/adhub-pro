-- إصلاح دالة إنشاء المهمة المجمعة لقراءة نوع المهمة من مهمة التركيب
CREATE OR REPLACE FUNCTION public.auto_create_composite_task()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_contract RECORD;
  v_installation_cost_for_customer NUMERIC := 0;
  v_installation_cost_for_company NUMERIC := 0;
  v_task_type TEXT;
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
  
  -- تحديد نوع المهمة من مهمة التركيب
  v_task_type := CASE 
    WHEN NEW.task_type = 'reinstallation' THEN 'reinstallation'
    ELSE 'new_installation'
  END;
  
  -- حساب تكلفة التركيب
  -- للتركيب الجديد: مجاني للزبون (جزء من العقد)
  -- لإعادة التركيب: يحسب على الزبون
  IF v_task_type = 'new_installation' AND v_contract.installation_enabled THEN
    v_installation_cost_for_customer := 0; -- مجاني للزبون في التركيب الأول
  ELSIF v_task_type = 'reinstallation' THEN
    v_installation_cost_for_customer := COALESCE(v_contract.installation_cost, 0); -- يحسب على الزبون في إعادة التركيب
  END IF;
  
  -- التكلفة الفعلية للشركة
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
    v_task_type,
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
$function$;

-- إضافة عمود الخصم للمهام المجمعة
ALTER TABLE composite_tasks ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE composite_tasks ADD COLUMN IF NOT EXISTS discount_reason TEXT;