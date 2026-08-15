-- Create trigger function to recompute expense paid amount and status when amount is changed
CREATE OR REPLACE FUNCTION public.trg_expenses_amount_change_recompute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    PERFORM public.recompute_expense_paid_amount(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Add trigger to expenses table
DROP TRIGGER IF EXISTS trg_expenses_amount_change ON public.expenses;
CREATE TRIGGER trg_expenses_amount_change
AFTER UPDATE OF amount ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.trg_expenses_amount_change_recompute();
