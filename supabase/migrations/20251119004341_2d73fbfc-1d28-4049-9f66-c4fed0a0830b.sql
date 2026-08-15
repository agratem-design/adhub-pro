-- ✅ Fix billboard history trigger to save individual billboard price and designs correctly

CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract_id BIGINT;
  v_customer_name TEXT;
  v_ad_type TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_total_rent NUMERIC;
  v_discount NUMERIC;
  v_total NUMERIC;
  v_installation_cost NUMERIC;
  v_billboard_price NUMERIC;
  v_team_name TEXT;
  v_design_a TEXT;
  v_design_b TEXT;
  v_design_name TEXT;
  v_duration_days INTEGER;
  v_billboard_ids TEXT;
  v_billboard_count INTEGER;
  v_individual_rent NUMERIC;
  v_individual_discount NUMERIC;
  v_billboard_prices_json TEXT;
  v_billboard_price_data JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    -- Get contract ID
    SELECT contract_id INTO v_contract_id FROM installation_tasks WHERE id = NEW.task_id;
    
    -- Get contract details
    SELECT 
      "Customer Name", 
      "Ad Type", 
      "Contract Date", 
      "End Date", 
      "Total Rent", 
      COALESCE("Discount", 0), 
      "Total", 
      installation_cost,
      billboard_ids,
      billboard_prices,
      CASE WHEN "End Date" IS NOT NULL AND "Contract Date" IS NOT NULL 
           THEN GREATEST(("End Date" - "Contract Date"), 0) ELSE NULL END
    INTO 
      v_customer_name, 
      v_ad_type, 
      v_start_date, 
      v_end_date, 
      v_total_rent, 
      v_discount, 
      v_total, 
      v_installation_cost, 
      v_billboard_ids,
      v_billboard_prices_json,
      v_duration_days
    FROM "Contract" WHERE "Contract_Number" = v_contract_id;
    
    -- Get billboard base price
    SELECT "Price" INTO v_billboard_price FROM billboards WHERE "ID" = NEW.billboard_id;
    
    -- Calculate billboard count
    IF v_billboard_ids IS NOT NULL AND v_billboard_ids != '' THEN
      SELECT array_length(string_to_array(v_billboard_ids, ','), 1) INTO v_billboard_count;
    ELSE
      v_billboard_count := 1;
    END IF;
    
    -- ✅ Try to get individual billboard price from billboard_prices JSON
    v_individual_rent := NULL;
    v_individual_discount := NULL;
    
    IF v_billboard_prices_json IS NOT NULL AND v_billboard_prices_json != '' THEN
      BEGIN
        -- Try to parse as JSON array
        v_billboard_price_data := v_billboard_prices_json::jsonb;
        
        -- Find this billboard's price in the array
        SELECT 
          (item->>'priceBeforeDiscount')::numeric,
          (item->>'discountPerBillboard')::numeric
        INTO v_individual_rent, v_individual_discount
        FROM jsonb_array_elements(v_billboard_price_data) AS item
        WHERE (item->>'billboardId')::bigint = NEW.billboard_id
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        -- If parsing fails, fall back to calculation
        v_individual_rent := NULL;
      END;
    END IF;
    
    -- ✅ Fallback: Calculate proportional rent if not found in billboard_prices
    IF v_individual_rent IS NULL AND v_billboard_count > 0 THEN
      v_individual_rent := v_total_rent / v_billboard_count;
      v_individual_discount := v_discount / v_billboard_count;
    END IF;
    
    -- Get team name
    SELECT team_name INTO v_team_name FROM installation_teams 
    WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id);
    
    -- ✅ Get designs - prioritize from installation_task_items (NEW record)
    v_design_a := NEW.design_face_a;
    v_design_b := NEW.design_face_b;
    
    -- If not in task items, try task_designs
    IF (v_design_a IS NULL OR v_design_a = '') AND NEW.selected_design_id IS NOT NULL THEN
      SELECT design_face_a_url, design_face_b_url, design_name 
      INTO v_design_a, v_design_b, v_design_name
      FROM task_designs WHERE id = NEW.selected_design_id;
    END IF;
    
    -- Final fallback: get from billboards table
    IF (v_design_a IS NULL OR v_design_a = '') AND (v_design_b IS NULL OR v_design_b = '') THEN
      SELECT design_face_a, design_face_b 
      INTO v_design_a, v_design_b
      FROM billboards WHERE "ID" = NEW.billboard_id;
    END IF;
    
    -- Delete any duplicate records
    DELETE FROM billboard_history
    WHERE billboard_id = NEW.billboard_id
      AND contract_number = v_contract_id
      AND COALESCE(installation_date::text, '') = COALESCE(NEW.installation_date::text, '');
    
    -- ✅ Insert new record with individual billboard rent amount
    INSERT INTO billboard_history (
      billboard_id, 
      contract_number, 
      customer_name, 
      ad_type, 
      start_date, 
      end_date,
      duration_days, 
      rent_amount,  -- ✅ Individual billboard rent (after discount)
      billboard_rent_price,  -- Billboard base price from billboards table
      installation_cost,
      discount_amount,  -- ✅ Individual billboard discount
      discount_percentage, 
      total_before_discount,  -- ✅ Individual billboard rent before discount
      installation_date,
      design_face_a_url,  -- ✅ Design from task or billboard
      design_face_b_url,  -- ✅ Design from task or billboard
      design_name,
      installed_image_face_a_url,
      installed_image_face_b_url, 
      team_name, 
      notes
    ) VALUES (
      NEW.billboard_id, 
      v_contract_id, 
      v_customer_name, 
      v_ad_type, 
      v_start_date, 
      v_end_date,
      v_duration_days, 
      COALESCE(v_individual_rent, 0) - COALESCE(v_individual_discount, 0),  -- ✅ Rent after discount
      v_billboard_price,  -- Base price from billboards table
      v_installation_cost,
      COALESCE(v_individual_discount, 0),  -- ✅ Individual discount
      CASE 
        WHEN v_individual_rent > 0 AND v_individual_discount > 0 
        THEN ROUND((v_individual_discount / v_individual_rent) * 100, 2) 
        ELSE 0 
      END,  -- Discount percentage
      COALESCE(v_individual_rent, 0),  -- ✅ Rent before discount
      NEW.installation_date, 
      v_design_a,  -- ✅ Design face A
      v_design_b,  -- ✅ Design face B
      v_design_name,
      NEW.installed_image_face_a_url, 
      NEW.installed_image_face_b_url, 
      v_team_name, 
      NEW.notes
    );
  END IF;
  RETURN NEW;
END;
$function$;