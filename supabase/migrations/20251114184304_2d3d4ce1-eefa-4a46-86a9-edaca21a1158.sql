-- تحديث function لجلب التصاميم من المكان الصحيح ومنع التكرار
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
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status != 'completed') THEN
    SELECT contract_id INTO v_contract_id FROM installation_tasks WHERE id = NEW.task_id;
    
    SELECT "Customer Name", "Ad Type", "Contract Date", "End Date", "Total Rent", 
           COALESCE("Discount", 0), "Total", installation_cost,
           CASE WHEN "End Date" IS NOT NULL AND "Contract Date" IS NOT NULL 
                THEN GREATEST(("End Date" - "Contract Date"), 0) ELSE NULL END
    INTO v_customer_name, v_ad_type, v_start_date, v_end_date, v_total_rent, 
         v_discount, v_total, v_installation_cost, v_duration_days
    FROM "Contract" WHERE "Contract_Number" = v_contract_id;
    
    SELECT "Price" INTO v_billboard_price FROM billboards WHERE "ID" = NEW.billboard_id;
    
    SELECT team_name INTO v_team_name FROM installation_teams 
    WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id);
    
    -- جلب التصاميم من installation_task_items مباشرة
    v_design_a := NEW.design_face_a;
    v_design_b := NEW.design_face_b;
    
    -- إذا كان هناك selected_design_id، جلب اسم التصميم منه
    IF NEW.selected_design_id IS NOT NULL THEN
      SELECT design_name INTO v_design_name
      FROM task_designs WHERE id = NEW.selected_design_id;
    END IF;
    
    -- إذا لم تكن التصاميم موجودة في task_items، جلبها من billboards
    IF v_design_a IS NULL AND v_design_b IS NULL THEN
      SELECT design_face_a, design_face_b INTO v_design_a, v_design_b
      FROM billboards WHERE "ID" = NEW.billboard_id;
    END IF;
    
    -- منع التكرار: التحقق من عدم وجود سجل مطابق
    IF NOT EXISTS (
      SELECT 1 FROM billboard_history
      WHERE billboard_id = NEW.billboard_id
        AND contract_number = v_contract_id
        AND COALESCE(installation_date, '1900-01-01'::date) = COALESCE(NEW.installation_date, '1900-01-01'::date)
    ) THEN
      INSERT INTO billboard_history (
        billboard_id, contract_number, customer_name, ad_type, start_date, end_date,
        duration_days, rent_amount, billboard_rent_price, installation_cost,
        discount_amount, discount_percentage, total_before_discount, installation_date,
        design_face_a_url, design_face_b_url, design_name,
        installed_image_face_a_url, installed_image_face_b_url, team_name, notes
      ) VALUES (
        NEW.billboard_id, v_contract_id, v_customer_name, v_ad_type, v_start_date, v_end_date,
        v_duration_days, v_total_rent, v_billboard_price, v_installation_cost,
        v_discount,
        CASE WHEN v_total_rent > 0 AND v_discount > 0 
             THEN ROUND((v_discount / v_total_rent) * 100, 2) ELSE 0 END,
        CASE WHEN v_total IS NOT NULL AND v_discount IS NOT NULL 
             THEN v_total + v_discount ELSE v_total_rent END,
        NEW.installation_date, v_design_a, v_design_b, v_design_name,
        NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, v_team_name, NEW.notes
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;