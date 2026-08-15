
-- 1. Trigger لتسجيل تغييرات عناصر مهام التركيب
CREATE OR REPLACE FUNCTION public.log_installation_item_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_billboard_name text;
  v_billboard_size text;
  v_nearest_landmark text;
  v_contract_number bigint;
  v_customer_name text;
  v_ad_type text;
  v_status_labels jsonb := '{"pending":"قيد الانتظار","in_progress":"قيد التنفيذ","completed":"مكتمل","cancelled":"ملغي"}'::jsonb;
BEGIN
  -- جلب بيانات اللوحة
  SELECT "Billboard_Name", "Size", "Nearest_Landmark"
  INTO v_billboard_name, v_billboard_size, v_nearest_landmark
  FROM billboards WHERE "ID" = COALESCE(NEW.billboard_id, OLD.billboard_id);

  -- جلب بيانات العقد
  SELECT it.contract_id INTO v_contract_number
  FROM installation_tasks it WHERE it.id = COALESCE(NEW.task_id, OLD.task_id);

  IF v_contract_number IS NOT NULL THEN
    SELECT "Customer Name", "Ad Type" INTO v_customer_name, v_ad_type
    FROM "Contract" WHERE "Contract_Number" = v_contract_number;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- تتبع الحالة
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('field', 'status', 'label', 'الحالة',
        'old', COALESCE(v_status_labels->>OLD.status, OLD.status),
        'new', COALESCE(v_status_labels->>NEW.status, NEW.status));
    END IF;

    -- تتبع صور التركيب
    IF OLD.installed_image_face_a_url IS DISTINCT FROM NEW.installed_image_face_a_url AND NEW.installed_image_face_a_url IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'installed_image_a', 'label', 'صورة التركيب (وجه أ)', 'new', NEW.installed_image_face_a_url);
    END IF;
    IF OLD.installed_image_face_b_url IS DISTINCT FROM NEW.installed_image_face_b_url AND NEW.installed_image_face_b_url IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'installed_image_b', 'label', 'صورة التركيب (وجه ب)', 'new', NEW.installed_image_face_b_url);
    END IF;

    -- تتبع التصميم
    IF OLD.design_face_a IS DISTINCT FROM NEW.design_face_a AND NEW.design_face_a IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'design_a', 'label', 'تصميم (وجه أ)', 'new', NEW.design_face_a);
    END IF;
    IF OLD.design_face_b IS DISTINCT FROM NEW.design_face_b AND NEW.design_face_b IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'design_b', 'label', 'تصميم (وجه ب)', 'new', NEW.design_face_b);
    END IF;

    -- تتبع التكاليف
    IF OLD.customer_installation_cost IS DISTINCT FROM NEW.customer_installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'customer_installation_cost', 'label', 'تكلفة التركيب (زبون)', 'old', COALESCE(OLD.customer_installation_cost, 0), 'new', COALESCE(NEW.customer_installation_cost, 0));
    END IF;
    IF OLD.company_installation_cost IS DISTINCT FROM NEW.company_installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_installation_cost', 'label', 'تكلفة التركيب (شركة)', 'old', COALESCE(OLD.company_installation_cost, 0), 'new', COALESCE(NEW.company_installation_cost, 0));
    END IF;
    IF OLD.company_additional_cost IS DISTINCT FROM NEW.company_additional_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_additional_cost', 'label', 'تكلفة إضافية (شركة)', 'old', COALESCE(OLD.company_additional_cost, 0), 'new', COALESCE(NEW.company_additional_cost, 0));
    END IF;

    -- تتبع تاريخ التركيب
    IF OLD.installation_date IS DISTINCT FROM NEW.installation_date THEN
      v_changes := v_changes || jsonb_build_object('field', 'installation_date', 'label', 'تاريخ التركيب', 'old', OLD.installation_date, 'new', NEW.installation_date);
    END IF;

    -- تتبع الملاحظات
    IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'notes', 'label', 'الملاحظات', 'old', OLD.notes, 'new', NEW.notes);
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل تركيب ' || COALESCE(v_billboard_name, 'لوحة ' || NEW.billboard_id) || COALESCE(' (' || v_billboard_size || ')', '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'installation_item', NEW.id::text, v_contract_number, v_customer_name, v_ad_type,
              v_description,
              jsonb_build_object('changes', v_changes, 'billboard_name', v_billboard_name, 'billboard_size', v_billboard_size, 'nearest_landmark', v_nearest_landmark),
              auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- إنشاء الـ trigger
DROP TRIGGER IF EXISTS trg_log_installation_item_changes ON public.installation_task_items;
CREATE TRIGGER trg_log_installation_item_changes
  AFTER UPDATE ON public.installation_task_items
  FOR EACH ROW EXECUTE FUNCTION public.log_installation_item_changes();

-- 2. تحديث trigger المهام المجمعة لإضافة حقول جديدة
CREATE OR REPLACE FUNCTION public.log_composite_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_ad_type text;
  v_contract_id bigint;
  v_status_labels jsonb := '{"pending":"قيد الانتظار","in_progress":"قيد التنفيذ","completed":"مكتمل","cancelled":"ملغي"}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  IF v_contract_id IS NOT NULL THEN
    SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('create', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name, v_ad_type,
            'إنشاء مهمة مجمعة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, ''),
            jsonb_build_object('task_type', NEW.task_type, 'customer_total', NEW.customer_total, 'company_total', NEW.company_total),
            auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('field', 'status', 'label', 'الحالة',
        'old', COALESCE(v_status_labels->>OLD.status, OLD.status),
        'new', COALESCE(v_status_labels->>NEW.status, NEW.status));
    END IF;

    IF OLD.customer_total IS DISTINCT FROM NEW.customer_total THEN
      v_changes := v_changes || jsonb_build_object('field', 'customer_total', 'label', 'إجمالي الزبون', 'old', COALESCE(OLD.customer_total, 0), 'new', COALESCE(NEW.customer_total, 0));
    END IF;

    IF OLD.company_total IS DISTINCT FROM NEW.company_total THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_total', 'label', 'إجمالي الشركة', 'old', COALESCE(OLD.company_total, 0), 'new', COALESCE(NEW.company_total, 0));
    END IF;

    IF OLD.discount_amount IS DISTINCT FROM NEW.discount_amount THEN
      v_changes := v_changes || jsonb_build_object('field', 'discount', 'label', 'الخصم', 'old', COALESCE(OLD.discount_amount, 0), 'new', COALESCE(NEW.discount_amount, 0));
    END IF;

    IF OLD.customer_installation_cost IS DISTINCT FROM NEW.customer_installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'install_cost', 'label', 'تكلفة التركيب (زبون)', 'old', COALESCE(OLD.customer_installation_cost, 0), 'new', COALESCE(NEW.customer_installation_cost, 0));
    END IF;

    IF OLD.customer_print_cost IS DISTINCT FROM NEW.customer_print_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'print_cost', 'label', 'تكلفة الطباعة (زبون)', 'old', COALESCE(OLD.customer_print_cost, 0), 'new', COALESCE(NEW.customer_print_cost, 0));
    END IF;

    -- حقول جديدة
    IF OLD.customer_cutout_cost IS DISTINCT FROM NEW.customer_cutout_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'customer_cutout_cost', 'label', 'تكلفة القص (زبون)', 'old', COALESCE(OLD.customer_cutout_cost, 0), 'new', COALESCE(NEW.customer_cutout_cost, 0));
    END IF;

    IF OLD.company_cutout_cost IS DISTINCT FROM NEW.company_cutout_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_cutout_cost', 'label', 'تكلفة القص (شركة)', 'old', COALESCE(OLD.company_cutout_cost, 0), 'new', COALESCE(NEW.company_cutout_cost, 0));
    END IF;

    IF OLD.company_installation_cost IS DISTINCT FROM NEW.company_installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_install_cost', 'label', 'تكلفة التركيب (شركة)', 'old', COALESCE(OLD.company_installation_cost, 0), 'new', COALESCE(NEW.company_installation_cost, 0));
    END IF;

    IF OLD.company_print_cost IS DISTINCT FROM NEW.company_print_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_print_cost', 'label', 'تكلفة الطباعة (شركة)', 'old', COALESCE(OLD.company_print_cost, 0), 'new', COALESCE(NEW.company_print_cost, 0));
    END IF;

    IF OLD.net_profit IS DISTINCT FROM NEW.net_profit THEN
      v_changes := v_changes || jsonb_build_object('field', 'net_profit', 'label', 'صافي الربح', 'old', COALESCE(OLD.net_profit, 0), 'new', COALESCE(NEW.net_profit, 0));
    END IF;

    IF OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      v_changes := v_changes || jsonb_build_object('field', 'paid_amount', 'label', 'المبلغ المدفوع', 'old', COALESCE(OLD.paid_amount, 0), 'new', COALESCE(NEW.paid_amount, 0));
    END IF;

    IF OLD.task_type IS DISTINCT FROM NEW.task_type THEN
      v_changes := v_changes || jsonb_build_object('field', 'task_type', 'label', 'نوع المهمة', 'old', OLD.task_type, 'new', NEW.task_type);
    END IF;

    IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'notes', 'label', 'الملاحظات', 'old', OLD.notes, 'new', NEW.notes);
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل مهمة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name, v_ad_type,
              v_description,
              jsonb_build_object('changes', v_changes, 'customer_total', NEW.customer_total, 'company_total', NEW.company_total, 'net_profit', NEW.net_profit),
              auth.uid());
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('delete', 'composite_task', OLD.id::text, OLD.contract_id, OLD.customer_name, v_ad_type,
            'حذف مهمة #' || OLD.task_number || COALESCE(' - ' || OLD.customer_name, ''),
            jsonb_build_object('customer_total', OLD.customer_total, 'company_total', OLD.company_total),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
