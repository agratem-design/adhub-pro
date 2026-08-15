-- ========================================================
-- Migration: Record primary and maintenance installations separately
-- Allow both initial installation and reinstallation (maintenance)
-- tasks under the same contract to be stored in billboard_history.
-- ========================================================

-- 1. Add task_type column to billboard_history
ALTER TABLE public.billboard_history
  ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'installation';

-- 2. Drop old unique index that prevented multiple records per (billboard_id, contract_number)
DROP INDEX IF EXISTS public.idx_billboard_history_unique_billboard_contract;

-- 3. Create new unique index that uses installation_date as well
--    so that primary + maintenance can both be stored
CREATE UNIQUE INDEX IF NOT EXISTS idx_billboard_history_unique_billboard_contract_date
  ON public.billboard_history (billboard_id, contract_number, installation_date)
  WHERE (contract_number IS NOT NULL);

-- 4. Update the main trigger function to include task_type
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_billboard RECORD;
  v_team_name TEXT := '';
  v_design_a TEXT := '';
  v_design_b TEXT := '';
  v_billboard_prices JSONB;
  v_price_data JSONB := NULL;
  v_individual_price NUMERIC := 0;
  v_individual_discount NUMERIC := 0;
  v_individual_install NUMERIC := 0;
  v_individual_print NUMERIC := 0;
  v_pricing_category TEXT := '';
  v_pricing_mode TEXT := '';
  v_billboard_count INT := 1;
  v_duration_days INT := 0;
  v_final_amount NUMERIC := 0;
  v_net_rental_amount NUMERIC := 0;
  v_discount_pct NUMERIC := 0;
  v_duration_text TEXT;
  v_include_install BOOLEAN := FALSE;
  v_include_print BOOLEAN := FALSE;
  v_start_date TEXT := NULL;
  v_end_date TEXT := NULL;
  v_task_type TEXT := 'installation';
  v_installation_date DATE;
BEGIN
  IF NEW.status != 'completed' THEN RETURN NEW; END IF;
  IF OLD IS NOT NULL AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT * INTO v_billboard FROM billboards WHERE "ID" = NEW.billboard_id;
  IF NOT FOUND OR v_billboard."Contract_Number" IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = v_billboard."Contract_Number";
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Get task_type from the parent installation_tasks row
  SELECT COALESCE(it.task_type, 'installation')
    INTO v_task_type
    FROM installation_tasks it
   WHERE it.id = NEW.task_id;

  SELECT t.team_name INTO v_team_name
  FROM installation_tasks it JOIN installation_teams t ON t.id = it.team_id
  WHERE it.id = NEW.task_id;

  -- 1. Get design URLs
  IF NEW.selected_design_id IS NOT NULL THEN
    SELECT design_face_a_url, design_face_b_url INTO v_design_a, v_design_b
    FROM task_designs WHERE id = NEW.selected_design_id;
  END IF;

  v_design_a := COALESCE(NULLIF(v_design_a, ''), COALESCE(NEW.design_face_a, v_billboard.design_face_a, ''));
  v_design_b := COALESCE(NULLIF(v_design_b, ''), COALESCE(NEW.design_face_b, v_billboard.design_face_b, ''));

  -- 2. Extract pricing details
  IF v_contract.billboard_prices IS NOT NULL AND v_contract.billboard_prices != '' THEN
    BEGIN
      v_billboard_prices := v_contract.billboard_prices::jsonb;
      IF jsonb_typeof(v_billboard_prices) = 'array' THEN
        SELECT elem INTO v_price_data FROM jsonb_array_elements(v_billboard_prices) AS elem
        WHERE (elem->>'billboardId')::text = NEW.billboard_id::text LIMIT 1;
        IF v_price_data IS NOT NULL THEN
          v_individual_price := COALESCE((v_price_data->>'priceBeforeDiscount')::numeric, (v_price_data->>'contractPrice')::numeric, 0);
          v_individual_discount := COALESCE((v_price_data->>'discountPerBillboard')::numeric, 0);
          v_individual_install := COALESCE((v_price_data->>'actualInstallationCost')::numeric, (v_price_data->>'installationCost')::numeric, 0);
          v_individual_print := COALESCE((v_price_data->>'actualPrintCost')::numeric, (v_price_data->>'printCost')::numeric, 0);
          v_pricing_category := COALESCE(v_price_data->>'pricingCategory', '');
          v_pricing_mode := COALESCE(v_price_data->>'pricingMode', '');
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  IF v_individual_price = 0 THEN
    IF v_contract.billboard_ids IS NOT NULL AND v_contract.billboard_ids != '' THEN
      v_billboard_count := array_length(string_to_array(v_contract.billboard_ids, ','), 1);
      IF v_billboard_count IS NULL OR v_billboard_count = 0 THEN v_billboard_count := 1; END IF;
    END IF;
    v_individual_price := COALESCE(v_contract."Total Rent", v_billboard."Price", 0) / v_billboard_count;
    v_individual_discount := COALESCE(v_contract."Discount", 0) / v_billboard_count;
    v_individual_install := COALESCE(v_contract.installation_cost, 0) / v_billboard_count;
    v_individual_print := COALESCE(v_contract.print_cost, 0) / v_billboard_count;
  END IF;

  IF NEW.customer_installation_cost IS NOT NULL AND NEW.customer_installation_cost > 0 THEN
    v_individual_install := NEW.customer_installation_cost;
  END IF;

  v_include_install := COALESCE(v_contract.include_installation_in_price, false);
  v_include_print := COALESCE(v_contract.include_print_in_billboard_price, false);

  -- Rent amount logic
  v_net_rental_amount := v_individual_price - v_individual_discount;

  IF v_include_install THEN
    v_net_rental_amount := v_net_rental_amount - v_individual_install;
  END IF;

  IF v_include_print THEN
    v_net_rental_amount := v_net_rental_amount - v_individual_print;
  END IF;

  v_final_amount := v_individual_price - v_individual_discount;
  IF NOT v_include_install THEN
    v_final_amount := v_final_amount + v_individual_install;
  END IF;
  IF NOT v_include_print THEN
    v_final_amount := v_final_amount + v_individual_print;
  END IF;

  IF v_individual_price > 0 THEN
    v_discount_pct := ROUND((v_individual_discount / v_individual_price) * 100, 2);
  END IF;

  v_duration_text := COALESCE(v_contract."Duration", '0');
  BEGIN
    v_duration_days := COALESCE(NULLIF(regexp_replace(v_duration_text, '[^0-9]', '', 'g'), '')::int, 0);
  EXCEPTION WHEN OTHERS THEN
    v_duration_days := 0;
  END;

  v_start_date := COALESCE(v_billboard."Rent_Start_Date", v_contract."Contract Date", '');
  v_end_date := COALESCE(v_billboard."Rent_End_Date", v_contract."End Date", '');

  v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE);

  INSERT INTO billboard_history (
    billboard_id, contract_number, customer_name, ad_type,
    start_date, end_date, duration_days,
    rent_amount, billboard_rent_price, discount_amount, discount_percentage,
    installation_cost, total_before_discount,
    print_cost, include_installation_in_price, include_print_in_price,
    pricing_category, pricing_mode,
    contract_total, contract_total_rent, contract_discount,
    installation_date,
    design_face_a_url, design_face_b_url,
    installed_image_face_a_url, installed_image_face_b_url,
    fallback_path_design_a, fallback_path_design_b,
    fallback_path_installed_a, fallback_path_installed_b,
    team_name, notes, individual_billboard_data, net_rental_amount,
    task_type
  ) VALUES (
    NEW.billboard_id, v_billboard."Contract_Number",
    COALESCE(v_contract."Customer Name", ''), COALESCE(v_contract."Ad Type", ''),
    v_start_date, v_end_date, v_duration_days,
    v_final_amount, COALESCE(v_billboard."Price", v_individual_price),
    v_individual_discount, v_discount_pct, v_individual_install, v_individual_price,
    v_individual_print,
    v_include_install, v_include_print,
    v_pricing_category, v_pricing_mode,
    COALESCE(v_contract."Total", 0), COALESCE(v_contract."Total Rent", 0),
    COALESCE(v_contract."Discount", 0),
    v_installation_date,
    v_design_a, v_design_b,
    NEW.installed_image_face_a_url, NEW.installed_image_face_b_url,
    NEW.fallback_path_design_a, NEW.fallback_path_design_b,
    NEW.fallback_path_installed_a, NEW.fallback_path_installed_b,
    COALESCE(v_team_name, ''), COALESCE(NEW.notes, ''), v_price_data, v_net_rental_amount,
    v_task_type
  )
  ON CONFLICT (billboard_id, contract_number, installation_date) WHERE (contract_number IS NOT NULL)
  DO UPDATE SET
    customer_name = EXCLUDED.customer_name, ad_type = EXCLUDED.ad_type,
    start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date,
    duration_days = EXCLUDED.duration_days, rent_amount = EXCLUDED.rent_amount,
    billboard_rent_price = EXCLUDED.billboard_rent_price,
    discount_amount = EXCLUDED.discount_amount, discount_percentage = EXCLUDED.discount_percentage,
    installation_cost = EXCLUDED.installation_cost, total_before_discount = EXCLUDED.total_before_discount,
    print_cost = EXCLUDED.print_cost,
    include_installation_in_price = EXCLUDED.include_installation_in_price,
    include_print_in_price = EXCLUDED.include_print_in_price,
    pricing_category = EXCLUDED.pricing_category, pricing_mode = EXCLUDED.pricing_mode,
    contract_total = EXCLUDED.contract_total, contract_total_rent = EXCLUDED.contract_total_rent,
    contract_discount = EXCLUDED.contract_discount,
    installation_date = EXCLUDED.installation_date,
    design_face_a_url = EXCLUDED.design_face_a_url, design_face_b_url = EXCLUDED.design_face_b_url,
    installed_image_face_a_url = EXCLUDED.installed_image_face_a_url,
    installed_image_face_b_url = EXCLUDED.installed_image_face_b_url,
    fallback_path_design_a = EXCLUDED.fallback_path_design_a,
    fallback_path_design_b = EXCLUDED.fallback_path_design_b,
    fallback_path_installed_a = EXCLUDED.fallback_path_installed_a,
    fallback_path_installed_b = EXCLUDED.fallback_path_installed_b,
    team_name = EXCLUDED.team_name, notes = EXCLUDED.notes,
    individual_billboard_data = EXCLUDED.individual_billboard_data,
    net_rental_amount = EXCLUDED.net_rental_amount,
    task_type = EXCLUDED.task_type,
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'save_billboard_history_on_item_completion error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- 5. Update the deletion trigger function as well
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_deletion()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
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
  v_task_type TEXT := 'installation';
BEGIN
  IF OLD.status = 'completed' THEN
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = (SELECT contract_id FROM installation_tasks WHERE id = OLD.task_id);
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = OLD.billboard_id;
    SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = OLD.task_id);

    SELECT COALESCE(it.task_type, 'installation')
      INTO v_task_type
      FROM installation_tasks it
     WHERE it.id = OLD.task_id;

    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    v_design_a := COALESCE(OLD.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_a");
    v_design_b := COALESCE(OLD.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_b");
    v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
    v_billboard_prices := v_contract.billboard_prices::JSONB;
    IF v_billboard_prices IS NOT NULL THEN
      SELECT value INTO v_price_entry FROM jsonb_array_elements(v_billboard_prices) AS value WHERE (value->>'billboardId')::BIGINT = OLD.billboard_id LIMIT 1;
      IF v_price_entry IS NOT NULL THEN
        v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2);
        v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2);
        v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2);
      END IF;
    END IF;
    IF v_rent_before_discount IS NULL THEN
      v_rent_before_discount := ROUND(COALESCE(v_contract."Total Rent", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_discount_per_billboard := ROUND(COALESCE(v_contract."Discount", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
      v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2);
    END IF;
    v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2);
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN
      v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date;
    ELSE v_duration_days := NULL; END IF;

    INSERT INTO billboard_history (
      billboard_id, contract_number, customer_name, ad_type,
      start_date, end_date, duration_days,
      billboard_rent_price, total_before_discount,
      discount_amount, discount_percentage,
      rent_amount, installation_cost, net_rental_amount,
      installation_date, team_name,
      design_face_a_url, design_face_b_url,
      installed_image_face_a_url, installed_image_face_b_url,
      notes, task_type
    )
    VALUES (
      OLD.billboard_id, v_contract."Contract_Number",
      v_contract."Customer Name", v_contract."Ad Type",
      v_contract."Contract Date", v_contract."End Date", v_duration_days,
      v_billboard_price, v_rent_before_discount,
      v_discount_per_billboard,
      CASE WHEN v_rent_before_discount > 0 THEN ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2) ELSE 0 END,
      v_rent_after_discount, v_installation_cost,
      ROUND(v_rent_after_discount - v_installation_cost, 2),
      v_installation_date, v_team_name,
      v_design_a, v_design_b,
      OLD.installed_image_face_a_url, OLD.installed_image_face_b_url,
      COALESCE(OLD.notes, '') || ' [تم الحذف/التراجع]',
      v_task_type
    )
    ON CONFLICT (billboard_id, contract_number, installation_date) WHERE (contract_number IS NOT NULL)
    DO UPDATE SET
      notes = COALESCE(billboard_history.notes, '') || ' [تم الحذف/التراجع]',
      task_type = EXCLUDED.task_type,
      updated_at = NOW();
  END IF;
  RETURN OLD;
END;
$function$;
