-- Trigger لإنشاء مهمة تركيب تلقائياً عند إنشاء عقد جديد
CREATE OR REPLACE FUNCTION create_installation_task_for_contract()
RETURNS TRIGGER AS $$
DECLARE
  v_billboards jsonb;
  v_billboard record;
  v_team_id uuid;
  v_task_id uuid;
  v_size text;
  v_installation_enabled boolean;
BEGIN
  -- التحقق من تفعيل التركيب في العقد
  v_installation_enabled := COALESCE(NEW.installation_enabled, true);
  
  IF NOT v_installation_enabled THEN
    RETURN NEW;
  END IF;
  
  -- استخراج اللوحات من العقد
  IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN
    -- الحصول على بيانات اللوحات
    FOR v_billboard IN 
      SELECT b."ID", b."Size"
      FROM billboards b
      WHERE b."ID" = ANY(string_to_array(NEW.billboard_ids, ',')::bigint[])
    LOOP
      v_size := v_billboard."Size";
      
      -- البحث عن فرقة تركيب مناسبة حسب الحجم
      SELECT id INTO v_team_id
      FROM installation_teams
      WHERE v_size = ANY(sizes)
      LIMIT 1;
      
      -- إذا لم توجد فرقة للحجم المحدد، نأخذ أي فرقة
      IF v_team_id IS NULL THEN
        SELECT id INTO v_team_id
        FROM installation_teams
        LIMIT 1;
      END IF;
      
      -- إنشاء مهمة التركيب أو الحصول على الموجودة
      INSERT INTO installation_tasks (contract_id, team_id, status)
      VALUES (NEW."Contract_Number", v_team_id, 'pending')
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_task_id;
      
      -- إذا لم يتم إنشاء مهمة جديدة، نحصل على المهمة الموجودة
      IF v_task_id IS NULL THEN
        SELECT id INTO v_task_id
        FROM installation_tasks
        WHERE contract_id = NEW."Contract_Number" AND team_id = v_team_id
        LIMIT 1;
      END IF;
      
      -- إضافة اللوحة إلى مهمة التركيب
      IF v_task_id IS NOT NULL THEN
        INSERT INTO installation_task_items (task_id, billboard_id, status)
        VALUES (v_task_id, v_billboard."ID", 'pending')
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط Trigger بجدول العقود
CREATE TRIGGER trigger_create_installation_task
AFTER INSERT ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION create_installation_task_for_contract();

-- Trigger لإنشاء مهمة طباعة تلقائياً عند إنشاء فاتورة طباعة
CREATE OR REPLACE FUNCTION create_print_task_for_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id uuid;
  v_total_area numeric := 0;
  v_total_cost numeric := 0;
BEGIN
  -- حساب المساحة والتكلفة الإجمالية
  SELECT 
    COALESCE(SUM(print_area), 0),
    COALESCE(SUM(print_cost), 0)
  INTO v_total_area, v_total_cost
  FROM printed_invoices
  WHERE id = NEW.id;
  
  -- إنشاء مهمة الطباعة
  INSERT INTO print_tasks (
    invoice_id,
    contract_id,
    customer_id,
    customer_name,
    printer_id,
    status,
    total_area,
    total_cost,
    priority
  ) VALUES (
    NEW.id,
    NEW.contract_id,
    NEW.customer_id,
    NEW.customer_name,
    NEW.printer_id,
    'pending',
    v_total_area,
    v_total_cost,
    'normal'
  )
  RETURNING id INTO v_task_id;
  
  -- إنشاء بنود مهمة الطباعة (تفاصيل الطباعة)
  IF v_task_id IS NOT NULL AND NEW.print_area IS NOT NULL AND NEW.print_area > 0 THEN
    INSERT INTO print_task_items (
      task_id,
      description,
      area,
      quantity,
      unit_cost,
      total_cost,
      status
    ) VALUES (
      v_task_id,
      'طباعة فاتورة رقم ' || NEW.invoice_number,
      NEW.print_area,
      1,
      NEW.print_cost / NULLIF(NEW.print_area, 0),
      NEW.print_cost,
      'pending'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط Trigger بجدول الفواتير المطبوعة
CREATE TRIGGER trigger_create_print_task
AFTER INSERT ON printed_invoices
FOR EACH ROW
EXECUTE FUNCTION create_print_task_for_invoice();

-- Trigger لحذف مهام التركيب عند إلغاء العقد
CREATE OR REPLACE FUNCTION delete_installation_task_on_contract_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- حذف مهام التركيب المرتبطة بالعقد الملغي
  DELETE FROM installation_tasks WHERE contract_id = OLD."Contract_Number";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_installation_task
AFTER DELETE ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION delete_installation_task_on_contract_delete();