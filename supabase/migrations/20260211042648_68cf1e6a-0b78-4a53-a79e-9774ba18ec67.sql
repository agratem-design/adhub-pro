
CREATE OR REPLACE FUNCTION public.sync_customer_info_to_contracts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.company IS DISTINCT FROM OLD.company
     OR NEW.phone IS DISTINCT FROM OLD.phone THEN

    UPDATE "Contract"
    SET "Customer Name" = NEW.name,
        "Company" = NEW.company,
        "Phone" = NEW.phone
    WHERE customer_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_customer_to_contracts_trigger
AFTER UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_info_to_contracts();
