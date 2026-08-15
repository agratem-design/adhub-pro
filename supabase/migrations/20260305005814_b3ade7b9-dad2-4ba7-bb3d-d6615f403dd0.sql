CREATE OR REPLACE FUNCTION public.auto_set_company_installation_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_size TEXT;
  v_base_price NUMERIC;
BEGIN
  -- Only set if company_installation_cost is NULL or 0
  IF NEW.company_installation_cost IS NULL OR NEW.company_installation_cost = 0 THEN
    -- Get billboard size
    SELECT "Size" INTO v_size
    FROM billboards
    WHERE "ID" = NEW.billboard_id;

    IF v_size IS NOT NULL THEN
      -- Get installation price from sizes table (primary)
      SELECT installation_price INTO v_base_price
      FROM sizes
      WHERE name = v_size
      LIMIT 1;

      -- Fallback to installation_print_pricing
      IF v_base_price IS NULL OR v_base_price = 0 THEN
        SELECT install_price INTO v_base_price
        FROM installation_print_pricing
        WHERE size = v_size
        LIMIT 1;
      END IF;

      IF v_base_price IS NOT NULL AND v_base_price > 0 THEN
        -- تكلفة التركيب = السعر الأساسي الكامل (بدون تقسيم على الأوجه)
        -- إعادة التركيب: × 1.5
        IF COALESCE(NEW.reinstall_count, 0) > 0 THEN
          NEW.company_installation_cost := v_base_price * 1.5;
        ELSE
          NEW.company_installation_cost := v_base_price;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;