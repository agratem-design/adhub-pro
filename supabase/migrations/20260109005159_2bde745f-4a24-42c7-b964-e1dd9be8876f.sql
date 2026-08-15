-- Fix remaining functions with search_path - Part 2

-- delete_composite_task_on_installation_delete
CREATE OR REPLACE FUNCTION public.delete_composite_task_on_installation_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  DELETE FROM composite_tasks WHERE installation_task_id = OLD.id;
  RETURN OLD;
END;
$$;

-- delete_cutout_task_invoice
CREATE OR REPLACE FUNCTION public.delete_cutout_task_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_composite = false AND OLD.invoice_id IS NOT NULL THEN
    DELETE FROM printed_invoices WHERE id = OLD.invoice_id;
  END IF;
  RETURN OLD;
END;
$$;

-- handle_billboard_removal_from_contract
CREATE OR REPLACE FUNCTION public.handle_billboard_removal_from_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_billboard_ids text[];
  new_billboard_ids text[];
  removed_id text;
  billboard_capital_remaining numeric;
  deduction_to_reverse numeric;
BEGIN
  IF OLD.billboard_ids IS NOT NULL THEN
    old_billboard_ids := string_to_array(OLD.billboard_ids, ',');
  ELSE
    old_billboard_ids := ARRAY[]::text[];
  END IF;
  
  IF NEW.billboard_ids IS NOT NULL THEN
    new_billboard_ids := string_to_array(NEW.billboard_ids, ',');
  ELSE
    new_billboard_ids := ARRAY[]::text[];
  END IF;
  
  FOREACH removed_id IN ARRAY old_billboard_ids
  LOOP
    removed_id := trim(removed_id);
    IF removed_id != '' AND NOT removed_id = ANY(new_billboard_ids) THEN
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = removed_id::bigint;
      
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards
        SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = removed_id::integer;
      END IF;
      
      DELETE FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = removed_id::bigint;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- handle_contract_deletion
CREATE OR REPLACE FUNCTION public.handle_contract_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  billboard_id_str text;
  billboard_ids_arr text[];
  deduction_to_reverse numeric;
BEGIN
  IF OLD.billboard_ids IS NOT NULL THEN
    billboard_ids_arr := string_to_array(OLD.billboard_ids, ',');
  ELSE
    billboard_ids_arr := ARRAY[]::text[];
  END IF;
  
  FOREACH billboard_id_str IN ARRAY billboard_ids_arr
  LOOP
    billboard_id_str := trim(billboard_id_str);
    IF billboard_id_str != '' THEN
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = billboard_id_str::bigint;
      
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards
        SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = billboard_id_str::integer;
      END IF;
    END IF;
  END LOOP;
  
  RETURN OLD;
END;
$$;

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
$$;

-- contracts_by_customer
CREATE OR REPLACE FUNCTION public.contracts_by_customer(cust_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'contract_number', c."Contract Number",
        'customer_name', cu."Customer Name",
        'contract_date', c."Contract Date",
        'total_amount', c."Total Amount",
        'paid_amount', c."Paid Amount",
        'remaining_amount', 
          COALESCE(c."Total Amount", 0) - COALESCE(c."Paid Amount", 0),
        'billboards', (
          SELECT CASE
            WHEN COUNT(b."Billboard Name") = 0 THEN NULL
            ELSE jsonb_agg(
              jsonb_build_object(
                'Billboard_Name', b."Billboard Name",
                'Rent_Start_Date', b."Rent Start Date",
                'Rent_End_Date', b."Rent End Date"
              )
            )
          END
          FROM "Billboards" b
          WHERE b."Contract Number" = c."Contract Number"
        )
      )
    )
    FROM "Contracts" c
    JOIN "Customers" cu ON cu.id = c.customer_id
    WHERE c.customer_id = cust_id
  );
END;
$$;