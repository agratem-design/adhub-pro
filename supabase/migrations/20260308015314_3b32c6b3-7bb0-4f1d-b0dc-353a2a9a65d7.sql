
-- 1. تحديث log_contract_changes() لتسجيل التغييرات بالتفصيل
CREATE OR REPLACE FUNCTION public.log_contract_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_added_ids bigint[];
  v_removed_ids bigint[];
  v_old_ids bigint[];
  v_new_ids bigint[];
  v_billboard_names text;
  v_status_labels jsonb := '{"partially_paid":"مدفوع جزئياً","paid":"مدفوع بالكامل","unpaid":"غير مدفوع","overdue":"متأخر"}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('create', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type",
            'إنشاء عقد جديد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", ''),
            jsonb_build_object('total', NEW."Total", 'discount', NEW."Discount", 'duration', NEW."Duration"),
            auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- تتبع تغيير اللوحات
    IF OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
      -- تحويل النصوص إلى مصفوفات
      IF OLD.billboard_ids IS NOT NULL AND OLD.billboard_ids != '' THEN
        SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_old_ids FROM unnest(string_to_array(OLD.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$';
      END IF;
      IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN
        SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_new_ids FROM unnest(string_to_array(NEW.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$';
      END IF;

      -- اللوحات المضافة
      IF v_new_ids IS NOT NULL THEN
        IF v_old_ids IS NOT NULL THEN
          SELECT ARRAY_AGG(x) INTO v_added_ids FROM unnest(v_new_ids) x WHERE NOT (x = ANY(v_old_ids));
        ELSE
          v_added_ids := v_new_ids;
        END IF;
      END IF;

      -- اللوحات المزالة
      IF v_old_ids IS NOT NULL THEN
        IF v_new_ids IS NOT NULL THEN
          SELECT ARRAY_AGG(x) INTO v_removed_ids FROM unnest(v_old_ids) x WHERE NOT (x = ANY(v_new_ids));
        ELSE
          v_removed_ids := v_old_ids;
        END IF;
      END IF;

      -- جلب أسماء اللوحات المضافة
      IF v_added_ids IS NOT NULL AND array_length(v_added_ids, 1) > 0 THEN
        SELECT string_agg(COALESCE(b."Billboard_Name", 'لوحة ' || b."ID") || COALESCE(' (' || b."Size" || ')', ''), ', ')
        INTO v_billboard_names FROM billboards b WHERE b."ID" = ANY(v_added_ids);
        v_changes := v_changes || jsonb_build_object('field', 'billboards_added', 'label', 'إضافة لوحات', 'new', v_billboard_names);
      END IF;

      -- جلب أسماء اللوحات المزالة
      IF v_removed_ids IS NOT NULL AND array_length(v_removed_ids, 1) > 0 THEN
        SELECT string_agg(COALESCE(b."Billboard_Name", 'لوحة ' || b."ID") || COALESCE(' (' || b."Size" || ')', ''), ', ')
        INTO v_billboard_names FROM billboards b WHERE b."ID" = ANY(v_removed_ids);
        v_changes := v_changes || jsonb_build_object('field', 'billboards_removed', 'label', 'إزالة لوحات', 'old', v_billboard_names);
      END IF;
    END IF;

    -- تتبع تغيير الإجمالي
    IF OLD."Total" IS DISTINCT FROM NEW."Total" THEN
      v_changes := v_changes || jsonb_build_object('field', 'total', 'label', 'الإجمالي', 'old', COALESCE(OLD."Total", 0), 'new', COALESCE(NEW."Total", 0));
    END IF;

    -- تتبع تغيير إجمالي الإيجار
    IF OLD."Total Rent" IS DISTINCT FROM NEW."Total Rent" THEN
      v_changes := v_changes || jsonb_build_object('field', 'total_rent', 'label', 'إجمالي الإيجار', 'old', COALESCE(OLD."Total Rent", 0), 'new', COALESCE(NEW."Total Rent", 0));
    END IF;

    -- تتبع تغيير الخصم
    IF OLD."Discount" IS DISTINCT FROM NEW."Discount" THEN
      v_changes := v_changes || jsonb_build_object('field', 'discount', 'label', 'الخصم', 'old', COALESCE(OLD."Discount", 0), 'new', COALESCE(NEW."Discount", 0));
    END IF;

    -- تتبع تغيير العميل
    IF OLD."Customer Name" IS DISTINCT FROM NEW."Customer Name" THEN
      v_changes := v_changes || jsonb_build_object('field', 'customer', 'label', 'العميل', 'old', OLD."Customer Name", 'new', NEW."Customer Name");
    END IF;

    -- تتبع تغيير تاريخ الانتهاء
    IF OLD."End Date" IS DISTINCT FROM NEW."End Date" THEN
      v_changes := v_changes || jsonb_build_object('field', 'end_date', 'label', 'تاريخ الانتهاء', 'old', OLD."End Date", 'new', NEW."End Date");
    END IF;

    -- تتبع تغيير تاريخ البداية
    IF OLD."Contract Date" IS DISTINCT FROM NEW."Contract Date" THEN
      v_changes := v_changes || jsonb_build_object('field', 'start_date', 'label', 'تاريخ البداية', 'old', OLD."Contract Date", 'new', NEW."Contract Date");
    END IF;

    -- تتبع تغيير حالة الدفع
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      v_changes := v_changes || jsonb_build_object('field', 'payment_status', 'label', 'حالة الدفع',
        'old', COALESCE(v_status_labels->>OLD.payment_status, OLD.payment_status),
        'new', COALESCE(v_status_labels->>NEW.payment_status, NEW.payment_status));
    END IF;

    -- تتبع تغيير نوع الإعلان
    IF OLD."Ad Type" IS DISTINCT FROM NEW."Ad Type" THEN
      v_changes := v_changes || jsonb_build_object('field', 'ad_type', 'label', 'نوع الإعلان', 'old', OLD."Ad Type", 'new', NEW."Ad Type");
    END IF;

    -- تتبع تغيير تكلفة التركيب
    IF OLD.installation_cost IS DISTINCT FROM NEW.installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'installation_cost', 'label', 'تكلفة التركيب', 'old', COALESCE(OLD.installation_cost, 0), 'new', COALESCE(NEW.installation_cost, 0));
    END IF;

    -- تتبع تغيير تكلفة الطباعة
    IF OLD.print_cost IS DISTINCT FROM NEW.print_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'print_cost', 'label', 'تكلفة الطباعة', 'old', COALESCE(OLD.print_cost, 0), 'new', COALESCE(NEW.print_cost, 0));
    END IF;

    -- تتبع تغيير المدة
    IF OLD."Duration" IS DISTINCT FROM NEW."Duration" THEN
      v_changes := v_changes || jsonb_build_object('field', 'duration', 'label', 'المدة', 'old', OLD."Duration", 'new', NEW."Duration");
    END IF;

    -- فقط سجل إذا كان هناك تغييرات فعلية
    IF jsonb_array_length(v_changes) > 0 THEN
      -- بناء وصف ملخص
      v_description := 'تعديل عقد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type",
              v_description,
              jsonb_build_object('changes', v_changes),
              auth.uid());
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('delete', 'contract', OLD."Contract_Number"::text, OLD."Contract_Number", OLD."Customer Name", OLD."Ad Type",
            'حذف عقد #' || OLD."Contract_Number" || COALESCE(' - ' || OLD."Customer Name", ''),
            jsonb_build_object('total', OLD."Total", 'discount', OLD."Discount"),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 2. تحديث log_payment_changes() لتسجيل تغييرات أكثر
CREATE OR REPLACE FUNCTION public.log_payment_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_name text;
  v_contract_num integer;
  v_ad_type text;
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_method_labels jsonb := '{"cash":"نقدي","check":"شيك","bank_transfer":"تحويل بنكي","card":"بطاقة","other":"أخرى"}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_contract_num := NEW.contract_number;
    v_customer_name := NEW.customer_name;
    IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
    END IF;
    IF v_contract_num IS NOT NULL THEN
      SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_num;
    END IF;
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('create', 'payment', NEW.id::text, v_contract_num, v_customer_name, v_ad_type,
            'إضافة دفعة ' || COALESCE(NEW.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, '') || ' (' || COALESCE(v_method_labels->>NEW.method, NEW.method, '') || ')',
            jsonb_build_object(
              'amount', NEW.amount,
              'method', NEW.method,
              'method_label', COALESCE(v_method_labels->>NEW.method, NEW.method),
              'entry_type', NEW.entry_type,
              'payment_reference', NEW.payment_reference,
              'distributed_payment_id', NEW.distributed_payment_id,
              'notes', NEW.notes
            ),
            auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_customer_name := NEW.customer_name;
    IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
    END IF;
    v_contract_num := NEW.contract_number;
    IF v_contract_num IS NOT NULL THEN
      SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_num;
    END IF;

    -- تتبع تغيير المبلغ
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      v_changes := v_changes || jsonb_build_object('field', 'amount', 'label', 'المبلغ', 'old', COALESCE(OLD.amount, 0), 'new', COALESCE(NEW.amount, 0));
    END IF;

    -- تتبع تغيير طريقة الدفع
    IF OLD.method IS DISTINCT FROM NEW.method THEN
      v_changes := v_changes || jsonb_build_object('field', 'method', 'label', 'طريقة الدفع',
        'old', COALESCE(v_method_labels->>OLD.method, OLD.method),
        'new', COALESCE(v_method_labels->>NEW.method, NEW.method));
    END IF;

    -- تتبع تغيير نوع القيد
    IF OLD.entry_type IS DISTINCT FROM NEW.entry_type THEN
      v_changes := v_changes || jsonb_build_object('field', 'entry_type', 'label', 'نوع القيد', 'old', OLD.entry_type, 'new', NEW.entry_type);
    END IF;

    -- تتبع تغيير المرجع
    IF OLD.payment_reference IS DISTINCT FROM NEW.payment_reference THEN
      v_changes := v_changes || jsonb_build_object('field', 'payment_reference', 'label', 'مرجع الدفعة', 'old', OLD.payment_reference, 'new', NEW.payment_reference);
    END IF;

    -- تتبع تغيير الملاحظات
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
      v_changes := v_changes || jsonb_build_object('field', 'notes', 'label', 'الملاحظات', 'old', OLD.notes, 'new', NEW.notes);
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل دفعة' || COALESCE(' عقد #' || v_contract_num, '') || COALESCE(' - ' || v_customer_name, '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'payment', NEW.id::text, v_contract_num, v_customer_name, v_ad_type,
              v_description,
              jsonb_build_object(
                'changes', v_changes,
                'amount', NEW.amount,
                'entry_type', NEW.entry_type,
                'payment_reference', NEW.payment_reference,
                'distributed_payment_id', NEW.distributed_payment_id,
                'notes', NEW.notes
              ),
              auth.uid());
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_customer_name := OLD.customer_name;
    IF v_customer_name IS NULL AND OLD.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = OLD.customer_id;
    END IF;
    v_contract_num := OLD.contract_number;
    IF v_contract_num IS NOT NULL THEN
      SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_num;
    END IF;
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('delete', 'payment', OLD.id::text, v_contract_num, v_customer_name, v_ad_type,
            'حذف دفعة ' || COALESCE(OLD.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, '') || ' (' || COALESCE(v_method_labels->>OLD.method, OLD.method, '') || ')',
            jsonb_build_object(
              'amount', OLD.amount,
              'method', OLD.method,
              'entry_type', OLD.entry_type,
              'payment_reference', OLD.payment_reference,
              'distributed_payment_id', OLD.distributed_payment_id,
              'notes', OLD.notes
            ),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

-- 3. تحديث log_composite_task_changes() لتسجيل تغييرات الحالة والتكاليف
CREATE OR REPLACE FUNCTION public.log_composite_task_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_status_labels jsonb := '{"pending":"قيد الانتظار","in_progress":"قيد التنفيذ","completed":"مكتمل","cancelled":"ملغي"}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
    VALUES ('create', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name,
            'إنشاء مهمة مجمعة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, ''),
            jsonb_build_object('task_type', NEW.task_type, 'customer_total', NEW.customer_total, 'company_total', NEW.company_total),
            auth.uid());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- تتبع تغيير الحالة
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_changes := v_changes || jsonb_build_object('field', 'status', 'label', 'الحالة',
        'old', COALESCE(v_status_labels->>OLD.status, OLD.status),
        'new', COALESCE(v_status_labels->>NEW.status, NEW.status));
    END IF;

    -- تتبع تغيير تكلفة الزبون
    IF OLD.customer_total IS DISTINCT FROM NEW.customer_total THEN
      v_changes := v_changes || jsonb_build_object('field', 'customer_total', 'label', 'إجمالي الزبون', 'old', COALESCE(OLD.customer_total, 0), 'new', COALESCE(NEW.customer_total, 0));
    END IF;

    -- تتبع تغيير تكلفة الشركة
    IF OLD.company_total IS DISTINCT FROM NEW.company_total THEN
      v_changes := v_changes || jsonb_build_object('field', 'company_total', 'label', 'إجمالي الشركة', 'old', COALESCE(OLD.company_total, 0), 'new', COALESCE(NEW.company_total, 0));
    END IF;

    -- تتبع تغيير الخصم
    IF OLD.discount_amount IS DISTINCT FROM NEW.discount_amount THEN
      v_changes := v_changes || jsonb_build_object('field', 'discount', 'label', 'الخصم', 'old', COALESCE(OLD.discount_amount, 0), 'new', COALESCE(NEW.discount_amount, 0));
    END IF;

    -- تتبع تغيير تكاليف التركيب
    IF OLD.customer_installation_cost IS DISTINCT FROM NEW.customer_installation_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'install_cost', 'label', 'تكلفة التركيب (زبون)', 'old', COALESCE(OLD.customer_installation_cost, 0), 'new', COALESCE(NEW.customer_installation_cost, 0));
    END IF;

    -- تتبع تغيير تكاليف الطباعة
    IF OLD.customer_print_cost IS DISTINCT FROM NEW.customer_print_cost THEN
      v_changes := v_changes || jsonb_build_object('field', 'print_cost', 'label', 'تكلفة الطباعة (زبون)', 'old', COALESCE(OLD.customer_print_cost, 0), 'new', COALESCE(NEW.customer_print_cost, 0));
    END IF;

    -- تتبع تغيير الملاحظات
    IF OLD.notes IS DISTINCT FROM NEW.notes AND NEW.notes IS NOT NULL THEN
      v_changes := v_changes || jsonb_build_object('field', 'notes', 'label', 'الملاحظات', 'old', OLD.notes, 'new', NEW.notes);
    END IF;

    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل مهمة #' || NEW.task_number || COALESCE(' - ' || NEW.customer_name, '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';

      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
      VALUES ('update', 'composite_task', NEW.id::text, NEW.contract_id, NEW.customer_name,
              v_description,
              jsonb_build_object('changes', v_changes, 'customer_total', NEW.customer_total, 'company_total', NEW.company_total),
              auth.uid());
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, description, details, user_id)
    VALUES ('delete', 'composite_task', OLD.id::text, OLD.contract_id, OLD.customer_name,
            'حذف مهمة #' || OLD.task_number || COALESCE(' - ' || OLD.customer_name, ''),
            jsonb_build_object('customer_total', OLD.customer_total, 'company_total', OLD.company_total),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
