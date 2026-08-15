-- Fix duration_days calculation - remove EXTRACT and use direct date subtraction

CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_contract RECORD;
  v_billboard RECORD;
  v_team_name TEXT;
  v_installation_date DATE;
  v_design_a TEXT;
  v_design_b TEXT;
  v_billboard_price NUMERIC(10,2);
  v_discount_per_billboard NUMERIC(10,2);
  v_rent_before_discount NUMERIC(10,2);
  v_rent_after_discount NUMERIC(10,2);
  v_installation_cost NUMERIC(10,2);
  v_billboard_prices JSONB;
  v_price_entry JSONB;
  v_discount_pct NUMERIC(10,2);
  v_duration_days INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT * INTO v_contract
    FROM "Contract"
    WHERE "Contract_Number" = (
      SELECT contract_id FROM installation_tasks WHERE id = NEW.task_id
    );
    
    SELECT * INTO v_billboard
    FROM billboards
    WHERE "ID" = NEW.billboard_id;
    
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
      COALESCE(v_contract.installation_cost, 0) / 
      NULLIF(v_contract.billboards_count, 0)::NUMERIC,
      2
    );
    
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    
    IF v_billboard_prices IS NOT NULL THEN
      SELECT value INTO v_price_entry
      FROM jsonb_array_elements(v_billboard_prices) AS value
      WHERE (value->>'billboardId')::BIGINT = NEW.billboard_id
      LIMIT 1;
      
      IF v_price_entry IS NOT NULL THEN
        v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2);
        v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2);
        v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2);
      END IF;
    END IF;
    
    IF v_rent_before_discount IS NULL THEN
      v_rent_before_discount := ROUND(
        COALESCE(v_contract."Total Rent", 0) / 
        NULLIF(v_contract.billboards_count, 0)::NUMERIC,
        2
      );
      
      v_discount_per_billboard := ROUND(
        COALESCE(v_contract."Discount", 0) / 
        NULLIF(v_contract.billboards_count, 0)::NUMERIC,
        2
      );
      
      v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2);
    END IF;
    
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    
    IF v_rent_before_discount > 0 THEN
      v_discount_pct := ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2);
    ELSE
      v_discount_pct := 0;
    END IF;
    
    -- Fix: Direct date subtraction for duration_days
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date;
    ELSE
      v_duration_days := NULL;
    END IF;
    
    INSERT INTO billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      billboard_rent_price,
      total_before_discount,
      discount_amount,
      discount_percentage,
      rent_amount,
      installation_cost,
      net_rental_amount,
      installation_date,
      team_name,
      design_face_a_url,
      design_face_b_url,
      installed_image_face_a_url,
      installed_image_face_b_url,
      notes
    ) VALUES (
      NEW.billboard_id,
      v_contract."Contract_Number",
      v_contract."Customer Name",
      v_contract."Ad Type",
      v_contract."Contract Date",
      v_contract."End Date",
      v_duration_days,
      v_billboard_price,
      v_rent_before_discount,
      v_discount_per_billboard,
      v_discount_pct,
      v_rent_after_discount,
      v_installation_cost,
      ROUND(v_rent_after_discount - v_installation_cost, 2),
      v_installation_date,
      v_team_name,
      v_design_a,
      v_design_b,
      NEW.installed_image_face_a_url,
      NEW.installed_image_face_b_url,
      NEW.notes
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_contract RECORD;
  v_billboard RECORD;
  v_team_name TEXT;
  v_installation_date DATE;
  v_design_a TEXT;
  v_design_b TEXT;
  v_billboard_price NUMERIC(10,2);
  v_discount_per_billboard NUMERIC(10,2);
  v_rent_before_discount NUMERIC(10,2);
  v_rent_after_discount NUMERIC(10,2);
  v_installation_cost NUMERIC(10,2);
  v_billboard_prices JSONB;
  v_price_entry JSONB;
  v_duration_days INTEGER;
BEGIN
  IF OLD.status = 'completed' THEN
    
    SELECT * INTO v_contract
    FROM "Contract"
    WHERE "Contract_Number" = (
      SELECT contract_id FROM installation_tasks WHERE id = OLD.task_id
    );
    
    SELECT * INTO v_billboard
    FROM billboards
    WHERE "ID" = OLD.billboard_id;
    
    SELECT team_name INTO v_team_name
    FROM installation_teams
    WHERE id = (
      SELECT team_id FROM installation_tasks WHERE id = OLD.task_id
    );
    
    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    
    v_design_a := COALESCE(
      OLD.design_face_a,
      (SELECT design_face_a_url FROM task_designs WHERE id = OLD.selected_design_id),
      v_billboard."design_face_a"
    );
    
    v_design_b := COALESCE(
      OLD.design_face_b,
      (SELECT design_face_b_url FROM task_designs WHERE id = OLD.selected_design_id),
      v_billboard."design_face_b"
    );
    
    v_installation_cost := ROUND(
      COALESCE(v_contract.installation_cost, 0) / 
      NULLIF(v_contract.billboards_count, 0)::NUMERIC,
      2
    );
    
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    
    IF v_billboard_prices IS NOT NULL THEN
      SELECT value INTO v_price_entry
      FROM jsonb_array_elements(v_billboard_prices) AS value
      WHERE (value->>'billboardId')::BIGINT = OLD.billboard_id
      LIMIT 1;
      
      IF v_price_entry IS NOT NULL THEN
        v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2);
        v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2);
        v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2);
      END IF;
    END IF;
    
    IF v_rent_before_discount IS NULL THEN
      v_rent_before_discount := ROUND(
        COALESCE(v_contract."Total Rent", 0) / 
        NULLIF(v_contract.billboards_count, 0)::NUMERIC,
        2
      );
      
      v_discount_per_billboard := ROUND(
        COALESCE(v_contract."Discount", 0) / 
        NULLIF(v_contract.billboards_count, 0)::NUMERIC,
        2
      );
      
      v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2);
    END IF;
    
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    
    -- Fix: Direct date subtraction for duration_days
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date;
    ELSE
      v_duration_days := NULL;
    END IF;
    
    INSERT INTO billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      billboard_rent_price,
      total_before_discount,
      discount_amount,
      discount_percentage,
      rent_amount,
      installation_cost,
      net_rental_amount,
      installation_date,
      team_name,
      design_face_a_url,
      design_face_b_url,
      installed_image_face_a_url,
      installed_image_face_b_url,
      notes
    ) VALUES (
      OLD.billboard_id,
      v_contract."Contract_Number",
      v_contract."Customer Name",
      v_contract."Ad Type",
      v_contract."Contract Date",
      v_contract."End Date",
      v_duration_days,
      v_billboard_price,
      v_rent_before_discount,
      v_discount_per_billboard,
      CASE WHEN v_rent_before_discount > 0 
        THEN ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2)
        ELSE 0 
      END,
      v_rent_after_discount,
      v_installation_cost,
      ROUND(v_rent_after_discount - v_installation_cost, 2),
      v_installation_date,
      v_team_name,
      v_design_a,
      v_design_b,
      OLD.installed_image_face_a_url,
      OLD.installed_image_face_b_url,
      COALESCE(OLD.notes, '') || ' [تم الحذف/التراجع]'
    );
    
  END IF;
  
  RETURN OLD;
END;
$function$;