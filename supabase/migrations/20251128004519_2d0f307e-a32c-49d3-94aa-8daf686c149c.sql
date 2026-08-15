-- Drop the trigger first with correct name
DROP TRIGGER IF EXISTS trigger_link_invoice_to_composite ON printed_invoices;

-- Now drop and recreate the function
DROP FUNCTION IF EXISTS public.link_invoice_to_composite() CASCADE;

-- Create a corrected version that only works on printed_invoices
CREATE OR REPLACE FUNCTION public.link_invoice_to_composite()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- This function is for printed_invoices table only
  -- No longer needed as we handle composite task linking differently
  RETURN NEW;
END;
$function$;