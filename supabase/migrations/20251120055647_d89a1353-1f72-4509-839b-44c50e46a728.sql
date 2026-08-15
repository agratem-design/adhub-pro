-- Add net_rental_amount column to billboard_history
ALTER TABLE billboard_history 
ADD COLUMN IF NOT EXISTS net_rental_amount NUMERIC(10,2);

-- Update the trigger function to save complete billboard history
CREATE OR REPLACE FUNCTION save_billboard_history_on_item_completion()
RETURNS TRIGGER AS $$
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
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get contract details
    SELECT * INTO v_contract
    FROM "Contract"
    WHERE "Contract_Number" = (
      SELECT contract_id FROM installation_tasks WHERE id = NEW.task_id
    );
    
    -- Get billboard details
    SELECT * INTO v_billboard
    FROM billboards
    WHERE "ID" = NEW.billboard_id;
    
    -- Get team name
    SELECT team_name INTO v_team_name
    FROM installation_teams
    WHERE id = (
      SELECT team_id FROM installation_tasks WHERE id = NEW.task_id
    );
    
    -- Get installation date from the task item
    v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE);
    
    -- Get design URLs - prioritize task item designs
    v_design_a := COALESCE(
      NEW.design_face_a,
      (SELECT design_url_a FROM task_designs WHERE id = NEW.selected_design_id),
      v_billboard."design_face_a"
    );
    
    v_design_b := COALESCE(
      NEW.design_face_b,
      (SELECT design_url_b FROM task_designs WHERE id = NEW.selected_design_id),
      v_billboard."design_face_b"
    );
    
    -- Get installation cost per billboard (divide by number of billboards)
    v_installation_cost := ROUND(
      COALESCE(v_contract.installation_cost, 0) / 
      NULLIF(v_contract.billboards_count, 0)::NUMERIC,
      2
    );
    
    -- Parse billboard_prices JSON to get individual billboard pricing
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    
    -- Find the price entry for this specific billboard
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
    
    -- Fallback: calculate proportional rent if not found in billboard_prices
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
    
    -- Get billboard base price
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    
    -- Calculate discount percentage
    DECLARE
      v_discount_pct NUMERIC(10,2);
    BEGIN
      IF v_rent_before_discount > 0 THEN
        v_discount_pct := ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2);
      ELSE
        v_discount_pct := 0;
      END IF;
    END;
    
    -- Insert into billboard_history
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
      EXTRACT(DAY FROM (v_contract."End Date" - v_contract."Contract Date"))::INTEGER,
      v_billboard_price,
      v_rent_before_discount,
      v_discount_per_billboard,
      v_discount_pct,
      v_rent_after_discount,
      v_installation_cost,
      ROUND(v_rent_after_discount - v_installation_cost, 2), -- net rental amount after installation cost
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
$$ LANGUAGE plpgsql;

-- Create trigger for task item deletion/rollback
CREATE OR REPLACE FUNCTION save_billboard_history_on_item_deletion()
RETURNS TRIGGER AS $$
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
BEGIN
  -- Only save history if the item was completed
  IF OLD.status = 'completed' THEN
    
    -- Get contract details
    SELECT * INTO v_contract
    FROM "Contract"
    WHERE "Contract_Number" = (
      SELECT contract_id FROM installation_tasks WHERE id = OLD.task_id
    );
    
    -- Get billboard details
    SELECT * INTO v_billboard
    FROM billboards
    WHERE "ID" = OLD.billboard_id;
    
    -- Get team name
    SELECT team_name INTO v_team_name
    FROM installation_teams
    WHERE id = (
      SELECT team_id FROM installation_tasks WHERE id = OLD.task_id
    );
    
    -- Get installation date
    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    
    -- Get design URLs
    v_design_a := COALESCE(
      OLD.design_face_a,
      (SELECT design_url_a FROM task_designs WHERE id = OLD.selected_design_id),
      v_billboard."design_face_a"
    );
    
    v_design_b := COALESCE(
      OLD.design_face_b,
      (SELECT design_url_b FROM task_designs WHERE id = OLD.selected_design_id),
      v_billboard."design_face_b"
    );
    
    -- Get installation cost per billboard
    v_installation_cost := ROUND(
      COALESCE(v_contract.installation_cost, 0) / 
      NULLIF(v_contract.billboards_count, 0)::NUMERIC,
      2
    );
    
    -- Parse billboard_prices JSON
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
    
    -- Fallback calculation
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
    
    -- Insert into billboard_history with notes indicating deletion
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
      EXTRACT(DAY FROM (v_contract."End Date" - v_contract."Contract Date"))::INTEGER,
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
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_save_billboard_history_on_completion ON installation_task_items;
DROP TRIGGER IF EXISTS trg_save_billboard_history_on_deletion ON installation_task_items;

-- Create trigger for completion
CREATE TRIGGER trg_save_billboard_history_on_completion
AFTER UPDATE ON installation_task_items
FOR EACH ROW
EXECUTE FUNCTION save_billboard_history_on_item_completion();

-- Create trigger for deletion
CREATE TRIGGER trg_save_billboard_history_on_deletion
BEFORE DELETE ON installation_task_items
FOR EACH ROW
EXECUTE FUNCTION save_billboard_history_on_item_deletion();