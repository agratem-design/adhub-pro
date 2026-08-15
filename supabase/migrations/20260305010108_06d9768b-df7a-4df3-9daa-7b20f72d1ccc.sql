-- Add total_reinstalled_faces column to track cumulative faces reinstalled
ALTER TABLE installation_task_items 
ADD COLUMN IF NOT EXISTS total_reinstalled_faces integer DEFAULT 0;

-- Fix HA1003: 3 faces total (2 first time + 1 second time), cost = 160 × 1.5 = 240
UPDATE installation_task_items 
SET total_reinstalled_faces = 3,
    company_installation_cost = 240
WHERE id = '6262a0ed-d28b-4a3e-ad9f-ee4f92613c66';

-- Fix TR-TG0350: 1 face reinstalled, cost = 300 × 0.5 = 150
UPDATE installation_task_items 
SET total_reinstalled_faces = 1,
    company_installation_cost = 150
WHERE id = 'c07d1b9f-e5ed-451f-b410-25b3efaf7345';

-- Fix TR-SJ0532: check if it also has reinstalls
UPDATE installation_task_items 
SET total_reinstalled_faces = CASE 
    WHEN reinstalled_faces = 'both' THEN COALESCE(faces_to_install, 2)
    WHEN reinstalled_faces IN ('face_a', 'face_b') THEN 1
    ELSE 0
  END
WHERE reinstall_count > 0 
AND total_reinstalled_faces = 0
AND id NOT IN ('6262a0ed-d28b-4a3e-ad9f-ee4f92613c66', 'c07d1b9f-e5ed-451f-b410-25b3efaf7345');

-- Update auto_set_company_installation_cost trigger
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
        -- كل وجه = 0.5 من السعر الأساسي
        IF COALESCE(NEW.total_reinstalled_faces, 0) > 0 THEN
          NEW.company_installation_cost := v_base_price * (NEW.total_reinstalled_faces * 0.5);
        ELSE
          NEW.company_installation_cost := v_base_price;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;