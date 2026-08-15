
-- ✅ 1. Trigger: مزامنة print_tasks → composite_tasks (عند تعديل أسعار مهمة الطباعة)
CREATE OR REPLACE FUNCTION public.sync_print_costs_to_composite()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.composite_tasks ct
  SET
    company_print_cost   = NEW.total_cost,
    customer_print_cost  = NEW.customer_total_amount,

    company_total  = COALESCE(ct.company_installation_cost, 0)
                   + COALESCE(NEW.total_cost, 0)
                   + COALESCE(ct.company_cutout_cost, 0),

    customer_total = COALESCE(ct.customer_installation_cost, 0)
                   + COALESCE(NEW.customer_total_amount, 0)
                   + COALESCE(ct.customer_cutout_cost, 0)
                   - COALESCE(ct.discount_amount, 0),

    net_profit = (
        COALESCE(ct.customer_installation_cost, 0)
      + COALESCE(NEW.customer_total_amount, 0)
      + COALESCE(ct.customer_cutout_cost, 0)
      - COALESCE(ct.discount_amount, 0)
    ) - (
        COALESCE(ct.company_installation_cost, 0)
      + COALESCE(NEW.total_cost, 0)
      + COALESCE(ct.company_cutout_cost, 0)
    ),

    profit_percentage = CASE
      WHEN (
        COALESCE(ct.customer_installation_cost, 0)
      + COALESCE(NEW.customer_total_amount, 0)
      + COALESCE(ct.customer_cutout_cost, 0)
      - COALESCE(ct.discount_amount, 0)
      ) > 0
      THEN (
        (
          (
            COALESCE(ct.customer_installation_cost, 0)
          + COALESCE(NEW.customer_total_amount, 0)
          + COALESCE(ct.customer_cutout_cost, 0)
          - COALESCE(ct.discount_amount, 0)
          ) - (
            COALESCE(ct.company_installation_cost, 0)
          + COALESCE(NEW.total_cost, 0)
          + COALESCE(ct.company_cutout_cost, 0)
          )
        ) / (
          COALESCE(ct.customer_installation_cost, 0)
        + COALESCE(NEW.customer_total_amount, 0)
        + COALESCE(ct.customer_cutout_cost, 0)
        - COALESCE(ct.discount_amount, 0)
        )
      ) * 100
      ELSE 0
    END,

    updated_at = now()
  WHERE ct.print_task_id = NEW.id
    AND (
      ct.company_print_cost IS DISTINCT FROM NEW.total_cost
      OR ct.customer_print_cost IS DISTINCT FROM NEW.customer_total_amount
    );

  RETURN NEW;
END;
$function$;

-- Create trigger on print_tasks
DROP TRIGGER IF EXISTS sync_print_costs_to_composite_trigger ON public.print_tasks;
CREATE TRIGGER sync_print_costs_to_composite_trigger
  AFTER UPDATE OF total_cost, customer_total_amount ON public.print_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_print_costs_to_composite();

-- ✅ 2. Trigger: composite_tasks → print_tasks (عند تعديل أسعار الطباعة في المهمة المجمعة)
CREATE OR REPLACE FUNCTION public.sync_composite_print_costs_to_print()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.print_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- على UPDATE: إذا لم تتغير تكاليف الطباعة، لا تعمل أي شيء
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.company_print_cost IS NOT DISTINCT FROM NEW.company_print_cost)
       AND (OLD.customer_print_cost IS NOT DISTINCT FROM NEW.customer_print_cost) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- حدّث مهمة الطباعة فقط إن كانت مختلفة لمنع loop
  UPDATE public.print_tasks p
  SET
    total_cost = COALESCE(NEW.company_print_cost, 0),
    customer_total_amount = COALESCE(NEW.customer_print_cost, 0)
  WHERE p.id = NEW.print_task_id
    AND (
      p.total_cost IS DISTINCT FROM COALESCE(NEW.company_print_cost, 0)
      OR p.customer_total_amount IS DISTINCT FROM COALESCE(NEW.customer_print_cost, 0)
    );

  RETURN NEW;
END;
$function$;

-- Create trigger on composite_tasks for print costs
DROP TRIGGER IF EXISTS sync_composite_print_costs_to_print_trigger ON public.composite_tasks;
CREATE TRIGGER sync_composite_print_costs_to_print_trigger
  AFTER INSERT OR UPDATE OF company_print_cost, customer_print_cost ON public.composite_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_composite_print_costs_to_print();
