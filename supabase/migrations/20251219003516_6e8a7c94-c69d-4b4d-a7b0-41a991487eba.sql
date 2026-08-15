
CREATE OR REPLACE FUNCTION public.sync_billboard_capital()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.billboards
  SET capital = COALESCE((SELECT SUM(capital_contribution) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0),
      capital_remaining = COALESCE((SELECT SUM(capital_remaining) FROM public.shared_billboards WHERE billboard_id = billboards."ID"), 0)
  WHERE billboards."ID" = COALESCE(NEW.billboard_id, OLD.billboard_id);
  RETURN NULL;
END;
$function$;
