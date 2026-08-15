-- Fix final remaining functions

-- auto_create_installation_tasks (large function)
CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  billboard_id_array bigint[];
  existing_billboard_ids bigint[];
  new_billboard_ids bigint[];
  removed_billboard_ids bigint[];
  team_rec RECORD;
  task_id_var uuid;
  is_update boolean;
BEGIN
  IF NEW."Contract_Number" < 1161 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.installation_enabled, true) = false THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint)) INTO billboard_id_array FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id WHERE TRIM(id) ~ '^\d+$';
  SELECT ARRAY_AGG(DISTINCT billboard_id) INTO existing_billboard_ids FROM installation_task_items iti JOIN installation_tasks it ON iti.task_id = it.id WHERE it.contract_id = NEW."Contract_Number";
  is_update := (existing_billboard_ids IS NOT NULL);
  IF is_update THEN
    SELECT ARRAY_AGG(x) INTO new_billboard_ids FROM unnest(billboard_id_array) x WHERE NOT (x = ANY(existing_billboard_ids));
    SELECT ARRAY_AGG(x) INTO removed_billboard_ids FROM unnest(existing_billboard_ids) x WHERE NOT (x = ANY(billboard_id_array));
    IF removed_billboard_ids IS NOT NULL THEN DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number") AND billboard_id = ANY(removed_billboard_ids); END IF;
    IF new_billboard_ids IS NOT NULL THEN
      FOR team_rec IN SELECT DISTINCT t.id, t.team_name, t.sizes FROM installation_teams t WHERE array_length(t.sizes, 1) > 0 LOOP
        IF EXISTS (SELECT 1 FROM billboards b WHERE b."ID" = ANY(new_billboard_ids) AND b."Size" = ANY(team_rec.sizes)) THEN
          SELECT id INTO task_id_var FROM installation_tasks WHERE contract_id = NEW."Contract_Number" AND team_id = team_rec.id LIMIT 1;
          IF task_id_var IS NULL THEN INSERT INTO installation_tasks (contract_id, team_id, status) VALUES (NEW."Contract_Number", team_rec.id, 'pending') RETURNING id INTO task_id_var; END IF;
          INSERT INTO installation_task_items (task_id, billboard_id, status) SELECT task_id_var, b."ID", 'pending' FROM billboards b WHERE b."ID" = ANY(new_billboard_ids) AND b."Size" = ANY(team_rec.sizes) ON CONFLICT (task_id, billboard_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number" AND id NOT IN (SELECT DISTINCT task_id FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number"));
  ELSE
    FOR team_rec IN SELECT DISTINCT t.id, t.team_name, t.sizes FROM installation_teams t WHERE array_length(t.sizes, 1) > 0 LOOP
      IF EXISTS (SELECT 1 FROM billboards b WHERE b."ID" = ANY(billboard_id_array) AND b."Size" = ANY(team_rec.sizes)) THEN
        INSERT INTO installation_tasks (contract_id, team_id, status) VALUES (NEW."Contract_Number", team_rec.id, 'pending') RETURNING id INTO task_id_var;
        INSERT INTO installation_task_items (task_id, billboard_id, status) SELECT task_id_var, b."ID", 'pending' FROM billboards b WHERE b."ID" = ANY(billboard_id_array) AND b."Size" = ANY(team_rec.sizes);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- release_partnership_capital
CREATE OR REPLACE FUNCTION public.release_partnership_capital()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  billboard_ids_array bigint[];
  v_billboard_id bigint;
BEGIN
  IF OLD.billboard_ids IS NULL OR TRIM(OLD.billboard_ids) = '' THEN RETURN OLD; END IF;
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint)) INTO billboard_ids_array FROM unnest(string_to_array(OLD.billboard_ids, ',')) AS id WHERE TRIM(id) ~ '^\d+$';
  FOR v_billboard_id IN SELECT unnest(billboard_ids_array) LOOP
    UPDATE shared_billboards sb SET reserved_amount = GREATEST(0, sb.reserved_amount - COALESCE((SELECT sb2.reserved_amount FROM shared_billboards sb2 WHERE sb2.billboard_id = v_billboard_id AND sb2.status = 'active' LIMIT 1), 0)) WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';
    UPDATE billboards SET capital_remaining = COALESCE((SELECT SUM(sb.capital_remaining + sb.reserved_amount) FROM shared_billboards sb WHERE sb.billboard_id = v_billboard_id), capital) WHERE "ID" = v_billboard_id;
  END LOOP;
  RETURN OLD;
END;
$$;

-- create_billboard_history_on_task_complete
CREATE OR REPLACE FUNCTION public.create_billboard_history_on_task_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_billboard RECORD; v_contract RECORD; v_team_name TEXT; v_design_a TEXT; v_design_b TEXT; v_installation_date DATE; v_installation_cost NUMERIC; v_billboard_price NUMERIC; v_discount_amount NUMERIC; v_discount_percentage NUMERIC; v_total_before_discount NUMERIC; v_duration_days INTEGER;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = NEW.billboard_id; IF NOT FOUND THEN RETURN NEW; END IF;
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = v_billboard."Contract_Number"; IF NOT FOUND THEN RETURN NEW; END IF;
    SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id);
    v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE);
    v_design_a := COALESCE(NEW.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_a");
    v_design_b := COALESCE(NEW.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_b");
    v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2);
    v_billboard_price := COALESCE(v_billboard."Price", 0); v_discount_amount := COALESCE(v_contract."Discount", 0);
    v_discount_percentage := CASE WHEN v_billboard_price > 0 THEN ROUND((v_discount_amount / v_billboard_price) * 100, 2) ELSE 0 END;
    v_total_before_discount := v_billboard_price + v_installation_cost;
    IF v_contract."Contract Date" IS NOT NULL AND v_contract."End Date" IS NOT NULL THEN v_duration_days := (v_contract."End Date"::date - v_contract."Contract Date"::date); ELSE v_duration_days := 0; END IF;
    INSERT INTO billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, rent_amount, billboard_rent_price, discount_amount, discount_percentage, installation_cost, total_before_discount, installation_date, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, team_name, notes) VALUES (NEW.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_total_before_discount - v_discount_amount, v_billboard_price, v_discount_amount, v_discount_percentage, v_installation_cost, v_total_before_discount, v_installation_date, v_design_a, v_design_b, NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, v_team_name, NEW.notes);
  END IF;
  RETURN NEW;
END;
$$;

-- update_billboard_history_on_task_uncomplete
CREATE OR REPLACE FUNCTION public.update_billboard_history_on_task_uncomplete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_billboard RECORD; v_contract RECORD; v_installation_date DATE;
BEGIN
  IF OLD.status = 'completed' AND NEW.status = 'pending' THEN
    SELECT * INTO v_billboard FROM billboards WHERE "ID" = OLD.billboard_id; IF NOT FOUND THEN RETURN NEW; END IF;
    SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = v_billboard."Contract_Number"; IF NOT FOUND THEN RETURN NEW; END IF;
    v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE);
    DELETE FROM billboard_history WHERE billboard_id = OLD.billboard_id AND contract_number = v_contract."Contract_Number" AND installation_date = v_installation_date;
  END IF;
  RETURN NEW;
END;
$$;

-- sync_friend_rental_data
CREATE OR REPLACE FUNCTION public.sync_friend_rental_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rental_item JSONB; billboard_price NUMERIC;
BEGIN
  DELETE FROM friend_billboard_rentals WHERE contract_number = NEW."Contract_Number";
  IF NEW.friend_rental_data IS NOT NULL AND jsonb_array_length(NEW.friend_rental_data) > 0 THEN
    FOR rental_item IN SELECT * FROM jsonb_array_elements(NEW.friend_rental_data) LOOP
      SELECT COALESCE((SELECT CAST(bp->>'contractPrice' AS NUMERIC) FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp WHERE bp->>'billboardId' = rental_item->>'billboardId'), (SELECT CAST(bp->>'priceAfterDiscount' AS NUMERIC) FROM jsonb_array_elements(NEW.billboard_prices::jsonb) bp WHERE bp->>'billboardId' = rental_item->>'billboardId'), 0) INTO billboard_price;
      INSERT INTO friend_billboard_rentals (billboard_id, contract_number, friend_company_id, friend_rental_cost, customer_rental_price, start_date, end_date, notes) VALUES (CAST(rental_item->>'billboardId' AS BIGINT), NEW."Contract_Number", CAST(rental_item->>'friendCompanyId' AS UUID), CAST(rental_item->>'friendRentalCost' AS NUMERIC), billboard_price, COALESCE(NEW."Contract Date", CURRENT_DATE), COALESCE(NEW."End Date", CURRENT_DATE + INTERVAL '30 days'), NULL) ON CONFLICT (billboard_id, contract_number) DO UPDATE SET friend_company_id = EXCLUDED.friend_company_id, friend_rental_cost = EXCLUDED.friend_rental_cost, customer_rental_price = EXCLUDED.customer_rental_price, start_date = EXCLUDED.start_date, end_date = EXCLUDED.end_date, updated_at = NOW();
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- save_billboard_history_on_item_completion (simplified)
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_completion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_contract RECORD; v_billboard RECORD; v_team_name TEXT; v_installation_date DATE; v_design_a TEXT; v_design_b TEXT; v_billboard_price NUMERIC(10,2); v_discount_per_billboard NUMERIC(10,2); v_rent_before_discount NUMERIC(10,2); v_rent_after_discount NUMERIC(10,2); v_installation_cost NUMERIC(10,2); v_billboard_prices JSONB; v_price_entry JSONB; v_discount_pct NUMERIC(10,2); v_duration_days INTEGER;
BEGIN IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = (SELECT contract_id FROM installation_tasks WHERE id = NEW.task_id); SELECT * INTO v_billboard FROM billboards WHERE "ID" = NEW.billboard_id; SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = NEW.task_id); v_installation_date := COALESCE(NEW.installation_date, CURRENT_DATE); v_design_a := COALESCE(NEW.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_a"); v_design_b := COALESCE(NEW.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = NEW.selected_design_id), v_billboard."design_face_b"); v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_billboard_prices := v_contract.billboard_prices::JSONB; IF v_billboard_prices IS NOT NULL THEN SELECT value INTO v_price_entry FROM jsonb_array_elements(v_billboard_prices) AS value WHERE (value->>'billboardId')::BIGINT = NEW.billboard_id LIMIT 1; IF v_price_entry IS NOT NULL THEN v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2); v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2); v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2); END IF; END IF; IF v_rent_before_discount IS NULL THEN v_rent_before_discount := ROUND(COALESCE(v_contract."Total Rent", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_discount_per_billboard := ROUND(COALESCE(v_contract."Discount", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2); END IF; v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2); IF v_rent_before_discount > 0 THEN v_discount_pct := ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2); ELSE v_discount_pct := 0; END IF; IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date; ELSE v_duration_days := NULL; END IF; INSERT INTO billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, billboard_rent_price, total_before_discount, discount_amount, discount_percentage, rent_amount, installation_cost, net_rental_amount, installation_date, team_name, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, notes) VALUES (NEW.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_billboard_price, v_rent_before_discount, v_discount_per_billboard, v_discount_pct, v_rent_after_discount, v_installation_cost, ROUND(v_rent_after_discount - v_installation_cost, 2), v_installation_date, v_team_name, v_design_a, v_design_b, NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, NEW.notes); END IF; RETURN NEW; END; $$;

-- save_billboard_history_on_item_deletion
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_item_deletion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_contract RECORD; v_billboard RECORD; v_team_name TEXT; v_installation_date DATE; v_design_a TEXT; v_design_b TEXT; v_billboard_price NUMERIC(10,2); v_discount_per_billboard NUMERIC(10,2); v_rent_before_discount NUMERIC(10,2); v_rent_after_discount NUMERIC(10,2); v_installation_cost NUMERIC(10,2); v_billboard_prices JSONB; v_price_entry JSONB; v_duration_days INTEGER;
BEGIN IF OLD.status = 'completed' THEN SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = (SELECT contract_id FROM installation_tasks WHERE id = OLD.task_id); SELECT * INTO v_billboard FROM billboards WHERE "ID" = OLD.billboard_id; SELECT team_name INTO v_team_name FROM installation_teams WHERE id = (SELECT team_id FROM installation_tasks WHERE id = OLD.task_id); v_installation_date := COALESCE(OLD.installation_date, CURRENT_DATE); v_design_a := COALESCE(OLD.design_face_a, (SELECT design_face_a_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_a"); v_design_b := COALESCE(OLD.design_face_b, (SELECT design_face_b_url FROM task_designs WHERE id = OLD.selected_design_id), v_billboard."design_face_b"); v_installation_cost := ROUND(COALESCE(v_contract.installation_cost, 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_billboard_prices := v_contract.billboard_prices::JSONB; IF v_billboard_prices IS NOT NULL THEN SELECT value INTO v_price_entry FROM jsonb_array_elements(v_billboard_prices) AS value WHERE (value->>'billboardId')::BIGINT = OLD.billboard_id LIMIT 1; IF v_price_entry IS NOT NULL THEN v_rent_before_discount := ROUND((v_price_entry->>'priceBeforeDiscount')::NUMERIC, 2); v_discount_per_billboard := ROUND((v_price_entry->>'discountPerBillboard')::NUMERIC, 2); v_rent_after_discount := ROUND((v_price_entry->>'priceAfterDiscount')::NUMERIC, 2); END IF; END IF; IF v_rent_before_discount IS NULL THEN v_rent_before_discount := ROUND(COALESCE(v_contract."Total Rent", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_discount_per_billboard := ROUND(COALESCE(v_contract."Discount", 0) / NULLIF(v_contract.billboards_count, 0)::NUMERIC, 2); v_rent_after_discount := ROUND(v_rent_before_discount - v_discount_per_billboard, 2); END IF; v_billboard_price := ROUND(COALESCE(v_billboard."Price", 0), 2); IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN v_duration_days := v_contract."End Date"::date - v_contract."Contract Date"::date; ELSE v_duration_days := NULL; END IF; INSERT INTO billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, billboard_rent_price, total_before_discount, discount_amount, discount_percentage, rent_amount, installation_cost, net_rental_amount, installation_date, team_name, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, notes) VALUES (OLD.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_billboard_price, v_rent_before_discount, v_discount_per_billboard, CASE WHEN v_rent_before_discount > 0 THEN ROUND((v_discount_per_billboard / v_rent_before_discount) * 100, 2) ELSE 0 END, v_rent_after_discount, v_installation_cost, ROUND(v_rent_after_discount - v_installation_cost, 2), v_installation_date, v_team_name, v_design_a, v_design_b, OLD.installed_image_face_a_url, OLD.installed_image_face_b_url, COALESCE(OLD.notes, '') || ' [تم الحذف/التراجع]') ON CONFLICT (billboard_id, contract_number) WHERE (contract_number IS NOT NULL) DO UPDATE SET notes = COALESCE(billboard_history.notes, '') || ' [تم الحذف/التراجع]', updated_at = NOW(); END IF; RETURN OLD; END; $$;