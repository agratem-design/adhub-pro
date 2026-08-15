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
  -- تحديد contract_id حسب العملية
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id;
  ELSE
    v_contract_id := NEW.contract_id;
  END IF;

  -- جلب نوع الإعلان من جدول العقود
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

    IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'notes', 'label', 'الملاحظات', 'old', OLD.notes, 'new', NEW.notes);
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل مهمة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name, v_ad_type,
              v_description,
              jsonb_build_object('changes', v_changes, 'customer_total', NEW.customer_total, 'company_total', NEW.company_total),
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