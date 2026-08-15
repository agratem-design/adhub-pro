-- Fix remaining EXTRACT usage causing "function pg_catalog.extract(unknown, integer) does not exist" on task completion
CREATE OR REPLACE FUNCTION public.create_billboard_history_on_task_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_billboard RECORD;
  v_contract RECORD;
  v_team_name TEXT;
  v_design_a TEXT;
  v_design_b TEXT;
  v_installation_date DATE;
  v_installation_cost NUMERIC;
  v_billboard_price NUMERIC;
  v_discount_amount NUMERIC;
  v_discount_percentage NUMERIC;
  v_total_before_discount NUMERIC;
  v_duration_days INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = NEW.billboard_id;
    IF NOT FOUND THEN
      RAISE WARNING 'Billboard % not found', NEW.billboard_id;
      RETURN NEW;
    END IF;

    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = v_billboard."Contract_Number";
    IF NOT FOUND THEN
      RAISE WARNING 'Contract % not found for billboard %', v_billboard."Contract_Number", NEW.billboard_id;
      RETURN NEW;
    END IF;

    SELECT team_name INTO v_team_name 
    FROM installation_teams 
    WHERE id = (
      SELECT team_id FROM installation_tasks WHERE id = NEW.task_id
    );

    v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE);

    v_design_a := COALESCE(
      NEW.design_face_a,
      (SELECT design_face_a_url FROM task_designs WHERE id = NEW.selected_design_id),
      v_billboard."design_face_a"
    );

    v_design_b := COALESCE(
      NEW.design_face_b,
      (SELECT design_face_b_url FROM task_designs WHERE id = NEW.selected_design_id),
      v_billboard."design_face_b"
    );

    v_installation_cost := ROUND(
      COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC,
      2
    );

    v_billboard_price := COALESCE(v_billboard."Price", 0);
    v_discount_amount := COALESCE(v_contract."Discount", 0);

    v_discount_percentage := CASE 
      WHEN v_billboard_price > 0 THEN ROUND((v_discount_amount / v_billboard_price) * 100, 2)
      ELSE 0
    END;

    v_total_before_discount := v_billboard_price + v_installation_cost;

    -- FIX: use direct date difference instead of EXTRACT on an integer
    IF v_contract."Contract Date" IS NOT NULL AND v_contract."End Date" IS NOT NULL THEN
      v_duration_days := (v_contract."End Date"::date - v_contract."Contract Date"::date);
    ELSE
      v_duration_days := 0;
    END IF;

    INSERT INTO billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      billboard_rent_price,
      discount_amount,
      discount_percentage,
      installation_cost,
      total_before_discount,
      installation_date,
      design_face_a_url,
      design_face_b_url,
      installed_image_face_a_url,
      installed_image_face_b_url,
      team_name,
      notes
    ) VALUES (
      NEW.billboard_id,
      v_contract."Contract_Number",
      v_contract."Customer Name",
      v_contract."Ad Type",
      v_contract."Contract Date",
      v_contract."End Date",
      v_duration_days,
      v_total_before_discount - v_discount_amount,
      v_billboard_price,
      v_discount_amount,
      v_discount_percentage,
      v_installation_cost,
      v_total_before_discount,
      v_installation_date,
      v_design_a,
      v_design_b,
      NEW.installed_image_face_a_url,
      NEW.installed_image_face_b_url,
      v_team_name,
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$function$;