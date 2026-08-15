-- Fix: اجعل مزامنة القص تعمل حتى لو تم تغيير total_cost عبر triggers أخرى (بدون UPDATE OF)

-- 1) إعادة تعريف الدالة مع search_path ثابت
CREATE OR REPLACE FUNCTION public.sync_cutout_costs_to_composite()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_customer_total NUMERIC;
  v_company_total  NUMERIC;
  v_net_profit     NUMERIC;
BEGIN
  -- على UPDATE: إذا لم تتغير القيم الفعلية، لا تعمل أي شيء
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.total_cost IS NOT DISTINCT FROM NEW.total_cost)
       AND (OLD.customer_total_amount IS NOT DISTINCT FROM NEW.customer_total_amount) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- حسابات متسقة (مع الخصم)
  -- ملاحظة: نستخدم قيم NEW من مهام القص + القيم الحالية من composite_tasks
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
      ct.company_cutout_cost  IS DISTINCT FROM NEW.total_cost
      OR ct.customer_cutout_cost IS DISTINCT FROM NEW.customer_total_amount
    );

  RETURN NEW;
END;
$$;

-- 2) إعادة إنشاء trigger على cutout_tasks بدون (UPDATE OF ...) لضمان التشغيل دائماً
DROP TRIGGER IF EXISTS sync_cutout_to_composite_trigger ON public.cutout_tasks;
CREATE TRIGGER sync_cutout_to_composite_trigger
AFTER INSERT OR UPDATE ON public.cutout_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_cutout_costs_to_composite();

-- 3) مزامنة عكسية: أي تعديل في composite_tasks على تكاليف القص ينعكس على cutout_tasks
CREATE OR REPLACE FUNCTION public.sync_composite_cutout_costs_to_cutout()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cutout_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- على UPDATE: إذا لم تتغير تكاليف القص، لا تعمل أي شيء
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.company_cutout_cost IS NOT DISTINCT FROM NEW.company_cutout_cost)
       AND (OLD.customer_cutout_cost IS NOT DISTINCT FROM NEW.customer_cutout_cost) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- حدّث مهمة القص فقط إن كانت مختلفة لمنع loop
  UPDATE public.cutout_tasks c
  SET
    total_cost = COALESCE(NEW.company_cutout_cost, 0),
    customer_total_amount = COALESCE(NEW.customer_cutout_cost, 0)
  WHERE c.id = NEW.cutout_task_id
    AND (
      c.total_cost IS DISTINCT FROM COALESCE(NEW.company_cutout_cost, 0)
      OR c.customer_total_amount IS DISTINCT FROM COALESCE(NEW.customer_cutout_cost, 0)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_composite_to_cutout_trigger ON public.composite_tasks;
CREATE TRIGGER sync_composite_to_cutout_trigger
AFTER UPDATE ON public.composite_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_composite_cutout_costs_to_cutout();