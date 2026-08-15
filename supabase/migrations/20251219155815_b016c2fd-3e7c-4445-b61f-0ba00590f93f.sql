-- تحسين: السماح بإعادة المزامنة حتى لو تم حفظ cutout_tasks بدون تغيير في القيم (لعلاج البيانات القديمة)

CREATE OR REPLACE FUNCTION public.sync_cutout_costs_to_composite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- نُحدّث فقط عندما تكون composite_tasks مختلفة عن قيم cutout_tasks الحالية
  UPDATE public.composite_tasks ct
  SET
    company_cutout_cost   = NEW.total_cost,
    customer_cutout_cost  = NEW.customer_total_amount,

    company_total  = COALESCE(ct.company_installation_cost, 0)
                   + COALESCE(ct.company_print_cost, 0)
                   + COALESCE(NEW.total_cost, 0),

    customer_total = COALESCE(ct.customer_installation_cost, 0)
                   + COALESCE(ct.customer_print_cost, 0)
                   + COALESCE(NEW.customer_total_amount, 0)
                   - COALESCE(ct.discount_amount, 0),

    net_profit = (
        COALESCE(ct.customer_installation_cost, 0)
      + COALESCE(ct.customer_print_cost, 0)
      + COALESCE(NEW.customer_total_amount, 0)
      - COALESCE(ct.discount_amount, 0)
    ) - (
        COALESCE(ct.company_installation_cost, 0)
      + COALESCE(ct.company_print_cost, 0)
      + COALESCE(NEW.total_cost, 0)
    ),

    profit_percentage = CASE
      WHEN (
        COALESCE(ct.customer_installation_cost, 0)
      + COALESCE(ct.customer_print_cost, 0)
      + COALESCE(NEW.customer_total_amount, 0)
      - COALESCE(ct.discount_amount, 0)
      ) > 0
      THEN (
        (
          (
            COALESCE(ct.customer_installation_cost, 0)
          + COALESCE(ct.customer_print_cost, 0)
          + COALESCE(NEW.customer_total_amount, 0)
          - COALESCE(ct.discount_amount, 0)
          ) - (
            COALESCE(ct.company_installation_cost, 0)
          + COALESCE(ct.company_print_cost, 0)
          + COALESCE(NEW.total_cost, 0)
          )
        ) / (
          COALESCE(ct.customer_installation_cost, 0)
        + COALESCE(ct.customer_print_cost, 0)
        + COALESCE(NEW.customer_total_amount, 0)
        - COALESCE(ct.discount_amount, 0)
        )
      ) * 100
      ELSE 0
    END,

    updated_at = now()
  WHERE ct.cutout_task_id = NEW.id
    AND (
      ct.company_cutout_cost IS DISTINCT FROM NEW.total_cost
      OR ct.customer_cutout_cost IS DISTINCT FROM NEW.customer_total_amount
    );

  RETURN NEW;
END;
$$;