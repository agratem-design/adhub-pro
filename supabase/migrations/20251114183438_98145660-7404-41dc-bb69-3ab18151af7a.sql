
-- ✅ COMPLETE FIX: Create function and trigger for billboard history

-- Step 1: Drop any existing triggers/functions
DO $$ 
BEGIN
  DROP TRIGGER IF EXISTS save_history_on_completion_trigger ON installation_task_items;
  DROP TRIGGER IF EXISTS delete_history_on_revert_trigger ON installation_task_items;
  DROP TRIGGER IF EXISTS create_billboard_history_trigger ON installation_tasks;
  DROP TRIGGER IF EXISTS save_billboard_history_trigger ON installation_task_items;
  DROP TRIGGER IF EXISTS handle_installation_revert_trigger ON installation_task_items;
END $$;

DROP FUNCTION IF EXISTS save_billboard_history_on_item_completion() CASCADE;
DROP FUNCTION IF EXISTS delete_billboard_history_on_revert() CASCADE;
DROP FUNCTION IF EXISTS create_billboard_history_on_completion() CASCADE;
DROP FUNCTION IF EXISTS handle_installation_revert() CASCADE;

-- Step 2: Create the main function to save history
CREATE FUNCTION save_billboard_history_on_item_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
BEGIN
  -- Only trigger when status changes to completed
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    
    -- Get contract_id from task
    SELECT contract_id INTO v_contract_id
    FROM installation_tasks
    WHERE id = NEW.task_id;
    
    -- Get contract data
    SELECT 
      "Customer Name",
      "Ad Type",
      "Contract Date",
      "End Date",
      "Total Rent",
      COALESCE("Discount", 0),
      "Total",
      installation_cost,
      CASE 
        WHEN "End Date" IS NOT NULL AND "Contract Date" IS NOT NULL 
        THEN GREATEST(("End Date" - "Contract Date"), 0)
        ELSE NULL
      END
    INTO 
      v_customer_name,
      v_ad_type,
      v_start_date,
      v_end_date,
      v_total_rent,
      v_discount,
      v_total,
      v_installation_cost,
      v_duration_days
    FROM "Contract"
    WHERE "Contract_Number" = v_contract_id;
    
    -- Get billboard price
    SELECT "Price" INTO v_billboard_price
    FROM billboards
    WHERE "ID" = NEW.billboard_id;
    
    -- Get team name
    SELECT team_name INTO v_team_name
    FROM installation_teams
    WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id);
    
    -- Get design data from task_designs if selected_design_id exists
    IF NEW.selected_design_id IS NOT NULL THEN
      SELECT 
        design_face_a_url,
        design_face_b_url,
        design_name
      INTO v_design_a, v_design_b, v_design_name
      FROM task_designs
      WHERE id = NEW.selected_design_id;
    END IF;
    
    -- Fallback to billboard designs if task_designs not found
    IF v_design_a IS NULL AND v_design_b IS NULL THEN
      SELECT design_face_a, design_face_b
      INTO v_design_a, v_design_b
      FROM billboards
      WHERE "ID" = NEW.billboard_id;
    END IF;
    
    -- Insert into history (only if not exists)
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
      installation_cost,
      discount_amount,
      discount_percentage,
      total_before_discount,
      installation_date,
      design_face_a_url,
      design_face_b_url,
      design_name,
      installed_image_face_a_url,
      installed_image_face_b_url,
      team_name,
      notes
    )
    SELECT
      NEW.billboard_id,
      v_contract_id,
      v_customer_name,
      v_ad_type,
      v_start_date,
      v_end_date,
      v_duration_days,
      v_total_rent,
      v_billboard_price,
      v_installation_cost,
      v_discount,
      CASE 
        WHEN v_total_rent > 0 AND v_discount > 0 
        THEN ROUND((v_discount / v_total_rent) * 100, 2)
        ELSE 0
      END,
      CASE 
        WHEN v_total IS NOT NULL AND v_discount IS NOT NULL 
        THEN v_total + v_discount
        ELSE v_total_rent
      END,
      NEW.installation_date,
      v_design_a,
      v_design_b,
      v_design_name,
      NEW.installed_image_face_a_url,
      NEW.installed_image_face_b_url,
      v_team_name,
      NEW.notes
    WHERE NOT EXISTS (
      SELECT 1 FROM billboard_history
      WHERE billboard_id = NEW.billboard_id
        AND contract_number = v_contract_id
        AND installation_date = NEW.installation_date
    );
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create function to delete history on revert
CREATE FUNCTION delete_billboard_history_on_revert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id BIGINT;
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'pending' THEN
    SELECT contract_id INTO v_contract_id
    FROM installation_tasks
    WHERE id = NEW.task_id;
    
    DELETE FROM billboard_history
    WHERE billboard_id = NEW.billboard_id
      AND contract_number = v_contract_id
      AND installation_date = OLD.installation_date;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 4: Create triggers
CREATE TRIGGER trg_save_history_on_completion
  AFTER UPDATE ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION save_billboard_history_on_item_completion();

CREATE TRIGGER trg_delete_history_on_revert
  AFTER UPDATE ON installation_task_items
  FOR EACH ROW
  EXECUTE FUNCTION delete_billboard_history_on_revert();
