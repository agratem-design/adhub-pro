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
              'reference', NEW.reference,
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

    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      v_changes := v_changes || jsonb_build_object('field', 'amount', 'label', 'المبلغ', 'old', COALESCE(OLD.amount, 0), 'new', COALESCE(NEW.amount, 0));
    END IF;

    IF OLD.method IS DISTINCT FROM NEW.method THEN
      v_changes := v_changes || jsonb_build_object('field', 'method', 'label', 'طريقة الدفع',
        'old', COALESCE(v_method_labels->>OLD.method, OLD.method),
        'new', COALESCE(v_method_labels->>NEW.method, NEW.method));
    END IF;

    IF OLD.entry_type IS DISTINCT FROM NEW.entry_type THEN
      v_changes := v_changes || jsonb_build_object('field', 'entry_type', 'label', 'نوع القيد', 'old', OLD.entry_type, 'new', NEW.entry_type);
    END IF;

    IF OLD.reference IS DISTINCT FROM NEW.reference THEN
      v_changes := v_changes || jsonb_build_object('field', 'reference', 'label', 'مرجع الدفعة', 'old', OLD.reference, 'new', NEW.reference);
    END IF;

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
                'reference', NEW.reference,
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
            'حذف دفعة ' || COALESCE(OLD.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, ''),
            jsonb_build_object('amount', OLD.amount, 'method', OLD.method, 'entry_type', OLD.entry_type),
            auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;