
-- تحديث trigger حساب تكلفة التركيب ليملأ customer_reinstall_cost تلقائياً
CREATE OR REPLACE FUNCTION public.auto_set_company_installation_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_size TEXT;
  v_base_price NUMERIC;
BEGIN
  IF NEW.company_installation_cost IS NULL OR NEW.company_installation_cost = 0 THEN
    SELECT "Size" INTO v_size FROM billboards WHERE "ID" = NEW.billboard_id;

    IF v_size IS NOT NULL THEN
      SELECT installation_price INTO v_base_price FROM sizes WHERE name = v_size LIMIT 1;
      IF v_base_price IS NULL OR v_base_price = 0 THEN
        SELECT install_price INTO v_base_price FROM installation_print_pricing WHERE size = v_size LIMIT 1;
      END IF;

      IF v_base_price IS NOT NULL AND v_base_price > 0 THEN
        IF COALESCE(NEW.total_reinstalled_faces, 0) > 0 THEN
          NEW.company_installation_cost := v_base_price * (NEW.total_reinstalled_faces * 0.5);
        ELSE
          NEW.company_installation_cost := v_base_price;
        END IF;
      END IF;
    END IF;
  END IF;

  -- تعبئة تكاليف إعادة التركيب تلقائياً
  IF COALESCE(NEW.reinstall_count, 0) > 0 THEN
    -- تكلفة إعادة التركيب = إجمالي تكلفة الزبون (لأن التركيب الأصلي مجاني)
    NEW.customer_reinstall_cost := COALESCE(NEW.customer_installation_cost, 0);
  ELSE
    -- لوحة عادية: التكلفة الأصلية = كامل التكلفة
    NEW.customer_original_install_cost := COALESCE(NEW.customer_installation_cost, 0);
    NEW.customer_reinstall_cost := 0;
  END IF;

  RETURN NEW;
END;
$function$;
