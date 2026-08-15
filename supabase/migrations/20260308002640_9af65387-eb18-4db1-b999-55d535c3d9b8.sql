
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
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_contract_num := NEW.contract_number;
    v_customer_name := NEW.customer_name;
    IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
      SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
    END IF;
    -- جلب نوع الإعلان من العقد
    IF v_contract_num IS NOT NULL THEN
      SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_num;
    END IF;
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('create', 'payment', NEW.id::text, v_contract_num, v_customer_name, v_ad_type,
            'إضافة دفعة ' || COALESCE(NEW.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, ''),
            jsonb_build_object(
              'amount', NEW.amount,
              'method', NEW.method,
              'entry_type', NEW.entry_type,
              'payment_reference', NEW.payment_reference,
              'distributed_payment_id', NEW.distributed_payment_id,
              'notes', NEW.notes
            ),
            auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
      v_customer_name := NEW.customer_name;
      IF v_customer_name IS NULL AND NEW.customer_id IS NOT NULL THEN
        SELECT name INTO v_customer_name FROM customers WHERE id = NEW.customer_id;
      END IF;
      v_contract_num := NEW.contract_number;
      IF v_contract_num IS NOT NULL THEN
        SELECT "Ad Type" INTO v_ad_type FROM "Contract" WHERE "Contract_Number" = v_contract_num;
      END IF;
      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'payment', NEW.id::text, v_contract_num, v_customer_name, v_ad_type,
              'تعديل دفعة من ' || COALESCE(OLD.amount::text, '0') || ' إلى ' || COALESCE(NEW.amount::text, '0') || ' د.ل',
              jsonb_build_object(
                'old_amount', OLD.amount,
                'new_amount', NEW.amount,
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
            'حذف دفعة ' || COALESCE(OLD.amount::text, '0') || ' د.ل' || COALESCE(' - ' || v_customer_name, ''),
            jsonb_build_object(
              'amount', OLD.amount,
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
