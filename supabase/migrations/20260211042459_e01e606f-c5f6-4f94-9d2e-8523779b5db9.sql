
CREATE OR REPLACE FUNCTION public.sync_contract_customer_info()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company TEXT;
  v_phone TEXT;
BEGIN
  -- Only run when customer_id changes
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NEW.customer_id IS NOT NULL THEN
    SELECT company, phone INTO v_company, v_phone
    FROM customers
    WHERE id = NEW.customer_id;

    NEW."Company" := v_company;
    NEW."Phone" := v_phone;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_contract_customer_info_trigger
BEFORE UPDATE ON public."Contract"
FOR EACH ROW
EXECUTE FUNCTION public.sync_contract_customer_info();
