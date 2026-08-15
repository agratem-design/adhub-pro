
-- Trigger function to auto-set company_installation_cost from sizes table
CREATE OR REPLACE FUNCTION public.auto_set_company_installation_cost()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_size TEXT;
  v_base_price NUMERIC;
  v_faces INTEGER;
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
        -- faces_to_install determines cost: base price is for 2 faces
        v_faces := COALESCE(NEW.faces_to_install, 2);
        
        IF v_faces = 1 THEN
          NEW.company_installation_cost := v_base_price / 2;
        ELSE
          NEW.company_installation_cost := (v_base_price * v_faces) / 2;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_auto_set_company_installation_cost ON installation_task_items;
CREATE TRIGGER trg_auto_set_company_installation_cost
  BEFORE INSERT OR UPDATE ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_company_installation_cost();

-- Backfill existing rows that have NULL company_installation_cost
UPDATE installation_task_items iti
SET company_installation_cost = CASE
  WHEN COALESCE(iti.faces_to_install, 2) = 1 THEN COALESCE(s.installation_price, ipp.install_price, 0) / 2
  ELSE (COALESCE(s.installation_price, ipp.install_price, 0) * COALESCE(iti.faces_to_install, 2)) / 2
END
FROM billboards b
LEFT JOIN sizes s ON s.name = b."Size"
LEFT JOIN installation_print_pricing ipp ON ipp.size = b."Size"
WHERE iti.billboard_id = b."ID"
  AND (iti.company_installation_cost IS NULL OR iti.company_installation_cost = 0)
  AND COALESCE(s.installation_price, ipp.install_price, 0) > 0;
