-- Fix remaining functions with search_path - Part 4 (Final)

-- auto_create_composite_task
CREATE OR REPLACE FUNCTION public.auto_create_composite_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_installation_cost_for_customer NUMERIC := 0;
  v_installation_cost_for_company NUMERIC := 0;
  v_task_type TEXT;
BEGIN
  SELECT 
    "Contract_Number",
    "Customer Name",
    customer_id,
    installation_enabled,
    installation_cost
  INTO v_contract
  FROM "Contract"
  WHERE "Contract_Number" = NEW.contract_id;
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  
  v_task_type := CASE 
    WHEN NEW.task_type = 'reinstallation' THEN 'reinstallation'
    ELSE 'new_installation'
  END;
  
  IF v_task_type = 'new_installation' AND v_contract.installation_enabled THEN
    v_installation_cost_for_customer := 0;
  ELSIF v_task_type = 'reinstallation' THEN
    v_installation_cost_for_customer := COALESCE(v_contract.installation_cost, 0);
  END IF;
  
  v_installation_cost_for_company := COALESCE(v_contract.installation_cost, 0);
  
  INSERT INTO composite_tasks (
    installation_task_id,
    contract_id,
    customer_id,
    customer_name,
    task_type,
    customer_installation_cost,
    company_installation_cost,
    customer_print_cost,
    company_print_cost,
    customer_cutout_cost,
    company_cutout_cost,
    status
  ) VALUES (
    NEW.id,
    NEW.contract_id,
    v_contract.customer_id,
    v_contract."Customer Name",
    v_task_type,
    v_installation_cost_for_customer,
    v_installation_cost_for_company,
    0,
    0,
    0,
    0,
    'pending'
  );
  
  RETURN NEW;
END;
$$;

-- calculate_composite_task_profit
CREATE OR REPLACE FUNCTION public.calculate_composite_task_profit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.customer_total := COALESCE(NEW.customer_installation_cost, 0) + 
                        COALESCE(NEW.customer_print_cost, 0) + 
                        COALESCE(NEW.customer_cutout_cost, 0) -
                        COALESCE(NEW.discount_amount, 0);
  
  NEW.company_total := COALESCE(NEW.company_installation_cost, 0) + 
                       COALESCE(NEW.company_print_cost, 0) + 
                       COALESCE(NEW.company_cutout_cost, 0);
  
  NEW.net_profit := NEW.customer_total - NEW.company_total;
  
  IF NEW.customer_total > 0 THEN
    NEW.profit_percentage := (NEW.net_profit / NEW.customer_total) * 100;
  ELSE
    NEW.profit_percentage := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

-- cleanup_billboard_references
CREATE OR REPLACE FUNCTION public.cleanup_billboard_references()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE "Contract" 
    SET billboard_ids = CASE 
        WHEN billboard_ids = OLD."ID"::text THEN NULL
        WHEN billboard_ids LIKE OLD."ID"::text || ',%' THEN SUBSTRING(billboard_ids FROM LENGTH(OLD."ID"::text) + 2)
        WHEN billboard_ids LIKE '%,' || OLD."ID"::text || ',%' THEN REPLACE(billboard_ids, ',' || OLD."ID"::text || ',', ',')
        WHEN billboard_ids LIKE '%,' || OLD."ID"::text THEN SUBSTRING(billboard_ids FROM 1 FOR LENGTH(billboard_ids) - LENGTH(OLD."ID"::text) - 1)
        ELSE billboard_ids
    END
    WHERE billboard_ids IS NOT NULL 
    AND billboard_ids LIKE '%' || OLD."ID"::text || '%';
    
    UPDATE "Contract" 
    SET billboards_data = CASE 
        WHEN billboards_data = OLD."ID"::text THEN NULL
        WHEN billboards_data LIKE OLD."ID"::text || ',%' THEN SUBSTRING(billboards_data FROM LENGTH(OLD."ID"::text) + 2)
        WHEN billboards_data LIKE '%,' || OLD."ID"::text || ',%' THEN REPLACE(billboards_data, ',' || OLD."ID"::text || ',', ',')
        WHEN billboards_data LIKE '%,' || OLD."ID"::text THEN SUBSTRING(billboards_data FROM 1 FOR LENGTH(billboards_data) - LENGTH(OLD."ID"::text) - 1)
        ELSE billboards_data
    END
    WHERE billboards_data IS NOT NULL 
    AND billboards_data LIKE '%' || OLD."ID"::text || '%';
    
    UPDATE "Contract" 
    SET billboard_ids = NULLIF(TRIM(billboard_ids), ''),
        billboards_data = NULLIF(TRIM(billboards_data), '')
    WHERE (billboard_ids IS NOT NULL AND TRIM(billboard_ids) = '') 
    OR (billboards_data IS NOT NULL AND TRIM(billboards_data) = '');
    
    RETURN OLD;
END;
$$;

-- confirm_partnership_capital
CREATE OR REPLACE FUNCTION public.confirm_partnership_capital()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id bigint;
  v_billboard_id bigint;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT contract_id INTO v_contract_id
    FROM installation_tasks
    WHERE id = NEW.task_id;

    v_billboard_id := NEW.billboard_id;

    IF EXISTS (
      SELECT 1 FROM shared_billboards sb
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active'
    ) THEN
      UPDATE shared_billboards
      SET 
        confirmed_amount = COALESCE(confirmed_amount, 0) + COALESCE(reserved_amount, 0),
        reserved_amount = 0,
        capital_remaining = GREATEST(0, capital_remaining - COALESCE(reserved_amount, 0))
      WHERE billboard_id = v_billboard_id AND status = 'active';

      UPDATE billboards
      SET capital_remaining = COALESCE(
        (SELECT SUM(capital_remaining) FROM shared_billboards WHERE billboard_id = v_billboard_id),
        0
      )
      WHERE "ID" = v_billboard_id;

      INSERT INTO shared_transactions (
        billboard_id,
        contract_id,
        partner_company_id,
        beneficiary,
        amount,
        type,
        transaction_date,
        notes
      )
      SELECT 
        v_billboard_id,
        v_contract_id,
        sb.partner_company_id,
        COALESCE(p.name, 'الفارس'),
        sb.reserved_amount * (sb.partner_pre_pct / 100.0),
        'capital_deduction',
        CURRENT_DATE,
        'خصم رأس المال عند إكمال التركيب للعقد ' || v_contract_id
      FROM shared_billboards sb
      LEFT JOIN partners p ON p.id = sb.partner_company_id
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- delete_composite_task_invoices
CREATE OR REPLACE FUNCTION public.delete_composite_task_invoices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.print_task_id IS NOT NULL THEN
    DELETE FROM printed_invoices 
    WHERE id IN (
      SELECT invoice_id FROM print_tasks WHERE id = OLD.print_task_id
    );
  END IF;
  
  IF OLD.cutout_task_id IS NOT NULL THEN
    DELETE FROM printed_invoices 
    WHERE id IN (
      SELECT invoice_id FROM cutout_tasks WHERE id = OLD.cutout_task_id
    );
  END IF;
  
  IF OLD.combined_invoice_id IS NOT NULL THEN
    DELETE FROM printed_invoices WHERE id = OLD.combined_invoice_id;
  END IF;
  
  RETURN OLD;
END;
$$;

-- create_installation_tasks_for_contract
CREATE OR REPLACE FUNCTION public.create_installation_tasks_for_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  v_size text;
  v_team_id uuid;
  v_task_id uuid;
  tasks_created int := 0;
  items_created int := 0;
BEGIN
  SELECT "Contract_Number", billboard_ids, installation_enabled
  INTO v_contract
  FROM "Contract"
  WHERE "Contract_Number" = p_contract_number;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'contract_not_found');
  END IF;

  IF COALESCE(v_contract.installation_enabled, true) = false THEN
    RETURN json_build_object('ok', false, 'error', 'installation_disabled');
  END IF;

  IF v_contract.billboard_ids IS NULL OR TRIM(v_contract.billboard_ids) = '' THEN
    RETURN json_build_object('ok', false, 'error', 'no_billboards');
  END IF;

  FOR v_billboard_id IN 
    SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
  LOOP
    SELECT "Size" INTO v_size FROM billboards WHERE "ID" = v_billboard_id;
    IF v_size IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_team_id
    FROM installation_teams
    WHERE v_size = ANY(sizes)
    LIMIT 1;

    IF v_team_id IS NULL THEN
      SELECT id INTO v_team_id FROM installation_teams LIMIT 1;
    END IF;

    IF v_team_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO installation_tasks (contract_id, team_id, status)
    VALUES (p_contract_number, v_team_id, 'pending')
    ON CONFLICT (contract_id, team_id) DO NOTHING
    RETURNING id INTO v_task_id;

    IF v_task_id IS NULL THEN
      SELECT id INTO v_task_id
      FROM installation_tasks
      WHERE contract_id = p_contract_number AND team_id = v_team_id
      LIMIT 1;
    ELSE
      tasks_created := tasks_created + 1;
    END IF;

    IF v_task_id IS NOT NULL THEN
      INSERT INTO installation_task_items (task_id, billboard_id, status)
      VALUES (v_task_id, v_billboard_id, 'pending')
      ON CONFLICT (task_id, billboard_id) DO NOTHING;
      IF FOUND THEN items_created := items_created + 1; END IF;
    END IF;
  END LOOP;

  RETURN json_build_object('ok', true, 'tasks_created', tasks_created, 'items_created', items_created);
END;
$$;

-- create_print_task_for_invoice_v2
CREATE OR REPLACE FUNCTION public.create_print_task_for_invoice_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_task_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM print_tasks WHERE invoice_id = NEW.id
  ) INTO v_task_exists;
  
  IF v_task_exists THEN
    RETURN NEW;
  END IF;
  
  IF NEW.invoice_number LIKE 'PTM-%' THEN
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$;

-- show_tables_summary
CREATE OR REPLACE FUNCTION public.show_tables_summary()
RETURNS TABLE(table_name text, structure json, sample_data json)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name AS tbl_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
  LOOP
    RETURN QUERY EXECUTE format($query$
      SELECT
        %L AS table_name,
        (
          SELECT json_agg(
            json_build_object(
              'column', c.column_name,
              'type', c.data_type,
              'nullable', c.is_nullable,
              'default', c.column_default
            )
          )
          FROM information_schema.columns c
          WHERE c.table_name = %L
            AND c.table_schema = 'public'
        ) AS structure,
        (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT * FROM %I LIMIT 3
          ) t
        ) AS sample_data
      $query$, r.tbl_name, r.tbl_name, r.tbl_name);
  END LOOP;
END;
$$;

-- sync_billboards_from_contract
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_id bigint;
  updated_count int := 0;
  row_ct int := 0;
BEGIN
  SELECT "Contract_Number", "Customer Name", "Ad Type", "Contract Date", "End Date", billboard_ids
    INTO v_contract
    FROM "Contract"
   WHERE "Contract_Number" = p_contract_number;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'contract_not_found');
  END IF;

  IF v_contract.billboard_ids IS NULL OR TRIM(v_contract.billboard_ids) = '' THEN
    RETURN json_build_object('ok', true, 'updated', 0);
  END IF;

  FOR v_billboard_id IN
    SELECT unnest(string_to_array(v_contract.billboard_ids, ',')::bigint[])
  LOOP
    UPDATE billboards
      SET "Contract_Number" = v_contract."Contract_Number",
          "Customer_Name" = v_contract."Customer Name",
          "Ad_Type" = v_contract."Ad Type",
          "Rent_Start_Date" = v_contract."Contract Date",
          "Rent_End_Date" = v_contract."End Date",
          "Status" = 'محجوز'
      WHERE "ID" = v_billboard_id;
    GET DIAGNOSTICS row_ct = ROW_COUNT;
    updated_count := updated_count + COALESCE(row_ct, 0);
  END LOOP;

  RETURN json_build_object('ok', true, 'updated', updated_count);
END;
$$;