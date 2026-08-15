-- تحديث دالة حساب الربح لتشمل الخصم
CREATE OR REPLACE FUNCTION public.calculate_composite_task_profit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- حساب الإجماليات
  NEW.customer_total := COALESCE(NEW.customer_installation_cost, 0) + 
                        COALESCE(NEW.customer_print_cost, 0) + 
                        COALESCE(NEW.customer_cutout_cost, 0) -
                        COALESCE(NEW.discount_amount, 0);
  
  NEW.company_total := COALESCE(NEW.company_installation_cost, 0) + 
                       COALESCE(NEW.company_print_cost, 0) + 
                       COALESCE(NEW.company_cutout_cost, 0);
  
  -- حساب صافي الربح
  NEW.net_profit := NEW.customer_total - NEW.company_total;
  
  -- حساب نسبة الربح
  IF NEW.customer_total > 0 THEN
    NEW.profit_percentage := (NEW.net_profit / NEW.customer_total) * 100;
  ELSE
    NEW.profit_percentage := 0;
  END IF;
  
  RETURN NEW;
END;
$function$;