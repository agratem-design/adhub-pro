-- Fix remaining functions with search_path - Part 3

-- link_invoice_to_composite
CREATE OR REPLACE FUNCTION public.link_invoice_to_composite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- mark_task_as_composite
CREATE OR REPLACE FUNCTION public.mark_task_as_composite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.print_task_id IS NOT NULL THEN
    UPDATE print_tasks 
    SET is_composite = true 
    WHERE id = NEW.print_task_id;
  END IF;
  
  IF NEW.cutout_task_id IS NOT NULL THEN
    UPDATE cutout_tasks 
    SET is_composite = true 
    WHERE id = NEW.cutout_task_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- reserve_partnership_capital
CREATE OR REPLACE FUNCTION public.reserve_partnership_capital()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  billboard_ids_array bigint[];
  v_billboard_id bigint;
  contract_start_date date;
  contract_end_date date;
  duration_months numeric;
  billboard_price numeric;
  total_deduction numeric;
BEGIN
  IF NEW.billboard_ids IS NULL OR TRIM(NEW.billboard_ids) = '' THEN
    RETURN NEW;
  END IF;

  contract_start_date := COALESCE(NEW."Contract Date", CURRENT_DATE);
  contract_end_date := COALESCE(NEW."End Date", contract_start_date + INTERVAL '30 days');
  
  duration_months := (contract_end_date - contract_start_date)::numeric / 30.44;
  IF duration_months < 1 THEN
    duration_months := 1;
  END IF;

  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint))
  INTO billboard_ids_array
  FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id
  WHERE TRIM(id) ~ '^\d+$';

  FOR v_billboard_id IN SELECT unnest(billboard_ids_array)
  LOOP
    IF EXISTS (
      SELECT 1 FROM shared_billboards sb
      WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active'
    ) THEN
      SELECT COALESCE(b."Price", 0) INTO billboard_price
      FROM billboards b WHERE b."ID" = v_billboard_id;

      total_deduction := (billboard_price * duration_months);

      UPDATE shared_billboards sb
      SET reserved_amount = COALESCE(sb.reserved_amount, 0) + (total_deduction * (sb.partner_pre_pct / 100.0))
      WHERE sb.billboard_id = v_billboard_id 
        AND sb.status = 'active';

      UPDATE billboards b
      SET capital_remaining = GREATEST(0, b.capital - COALESCE(
        (SELECT SUM(sb2.confirmed_amount + sb2.reserved_amount) 
         FROM shared_billboards sb2 
         WHERE sb2.billboard_id = v_billboard_id),
        0
      ))
      WHERE b."ID" = v_billboard_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- round function
CREATE OR REPLACE FUNCTION public.round(val double precision, digits integer)
RETURNS double precision
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
           WHEN val IS NULL OR digits IS NULL THEN NULL
           ELSE ROUND(val::numeric, digits)::double precision
         END
$$;

-- shared_company_summary
CREATE OR REPLACE FUNCTION public.shared_company_summary(p_beneficiary text)
RETURNS TABLE(total_due numeric, total_paid numeric)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(s.total_due,0)::numeric, coalesce(s.total_paid,0)::numeric
  FROM public.shared_beneficiary_summary s
  WHERE s.beneficiary = p_beneficiary
$$;

-- sync_billboard_capital
CREATE OR REPLACE FUNCTION public.sync_billboard_capital()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.billboards
  SET capital = COALESCE((SELECT SUM(capital_contribution) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0),
      capital_remaining = COALESCE((SELECT SUM(capital_remaining) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0)
  WHERE billboards."ID" = COALESCE(NEW.billboard_id, OLD.billboard_id);
  RETURN NULL;
END;
$$;

-- sync_contract_seq
CREATE OR REPLACE FUNCTION public.sync_contract_seq()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM setval('"Contract_id_seq"', (SELECT MAX("Contract_Number") FROM "Contract"));
  RETURN NEW;
END;
$$;

-- sync_composite_task_installation_cost
CREATE OR REPLACE FUNCTION public.sync_composite_task_installation_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_installation_task_id uuid;
  v_total_customer_cost numeric;
BEGIN
  v_installation_task_id := COALESCE(NEW.task_id, OLD.task_id);
  
  SELECT COALESCE(SUM(customer_installation_cost), 0)
  INTO v_total_customer_cost
  FROM installation_task_items
  WHERE task_id = v_installation_task_id;
  
  UPDATE composite_tasks
  SET customer_installation_cost = v_total_customer_cost,
      updated_at = now()
  WHERE installation_task_id = v_installation_task_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- t_sync_billboards_from_contract
CREATE OR REPLACE FUNCTION public.t_sync_billboards_from_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_billboards_from_contract(NEW."Contract_Number");
  RETURN NEW;
END;
$$;

-- update_billboard_status_based_on_contract
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW."Rent_End_Date" IS NOT NULL AND NEW."Rent_End_Date" <= CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  END IF;
  RETURN NEW;
END;
$$;

-- update_billboard_status_based_on_dates
CREATE OR REPLACE FUNCTION public.update_billboard_status_based_on_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW."Rent_End_Date" IS NULL OR NEW."Rent_End_Date" < CURRENT_DATE THEN
    NEW."Status" := 'متاح';
  ELSIF NEW."Rent_Start_Date" <= CURRENT_DATE AND NEW."Rent_End_Date" >= CURRENT_DATE THEN
    NEW."Status" := 'محجوز';
  END IF;
  RETURN NEW;
END;
$$;

-- update_composite_task_on_task_link
CREATE OR REPLACE FUNCTION public.update_composite_task_on_task_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.print_task_id IS NOT NULL AND OLD.print_task_id IS DISTINCT FROM NEW.print_task_id THEN
    UPDATE composite_tasks
    SET print_task_id = NEW.print_task_id
    WHERE installation_task_id = NEW.id;
  END IF;
  
  IF NEW.cutout_task_id IS NOT NULL AND OLD.cutout_task_id IS DISTINCT FROM NEW.cutout_task_id THEN
    UPDATE composite_tasks
    SET cutout_task_id = NEW.cutout_task_id
    WHERE installation_task_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- update_custody_balance
CREATE OR REPLACE FUNCTION public.update_custody_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'deposit' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.custody_account_id;
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.custody_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type = 'deposit' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.custody_account_id;
    ELSIF OLD.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.custody_account_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- update_custody_on_expense
CREATE OR REPLACE FUNCTION public.update_custody_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE custody_accounts 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.custody_account_id;
    
    INSERT INTO custody_transactions (
      custody_account_id,
      transaction_type,
      amount,
      transaction_date,
      description,
      receipt_number
    ) VALUES (
      NEW.custody_account_id,
      'expense',
      NEW.amount,
      NEW.expense_date,
      NEW.description,
      NEW.receipt_number
    );
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE custody_accounts 
    SET current_balance = current_balance + OLD.amount
    WHERE id = OLD.custody_account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;