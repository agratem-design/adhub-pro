-- مزامنة تكاليف القص من cutout_tasks إلى composite_tasks وإعادة حساب الإجماليات
UPDATE composite_tasks ct
SET 
  company_cutout_cost = cut.total_cost,
  customer_cutout_cost = cut.customer_total_amount,
  company_total = COALESCE(ct.company_installation_cost, 0) + COALESCE(ct.company_print_cost, 0) + COALESCE(cut.total_cost, 0),
  customer_total = COALESCE(ct.customer_installation_cost, 0) + COALESCE(ct.customer_print_cost, 0) + COALESCE(cut.customer_total_amount, 0) - COALESCE(ct.discount_amount, 0),
  net_profit = (COALESCE(ct.customer_installation_cost, 0) + COALESCE(ct.customer_print_cost, 0) + COALESCE(cut.customer_total_amount, 0) - COALESCE(ct.discount_amount, 0))
             - (COALESCE(ct.company_installation_cost, 0) + COALESCE(ct.company_print_cost, 0) + COALESCE(cut.total_cost, 0)),
  updated_at = now()
FROM cutout_tasks cut
WHERE ct.cutout_task_id = cut.id
  AND (ct.company_cutout_cost IS DISTINCT FROM cut.total_cost 
    OR ct.customer_cutout_cost IS DISTINCT FROM cut.customer_total_amount);

-- مزامنة تكاليف الطباعة من print_tasks إلى composite_tasks وإعادة حساب الإجماليات
UPDATE composite_tasks ct
SET 
  company_print_cost = pt.total_cost,
  customer_print_cost = pt.customer_total_amount,
  company_total = COALESCE(ct.company_installation_cost, 0) + COALESCE(pt.total_cost, 0) + COALESCE(ct.company_cutout_cost, 0),
  customer_total = COALESCE(ct.customer_installation_cost, 0) + COALESCE(pt.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0),
  net_profit = (COALESCE(ct.customer_installation_cost, 0) + COALESCE(pt.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0))
             - (COALESCE(ct.company_installation_cost, 0) + COALESCE(pt.total_cost, 0) + COALESCE(ct.company_cutout_cost, 0)),
  updated_at = now()
FROM print_tasks pt
WHERE ct.print_task_id = pt.id
  AND (ct.company_print_cost IS DISTINCT FROM pt.total_cost 
    OR ct.customer_print_cost IS DISTINCT FROM pt.customer_total_amount);

-- إعادة حساب نسبة الربح لجميع المهام المجمعة
UPDATE composite_tasks
SET profit_percentage = CASE 
    WHEN customer_total > 0 THEN (net_profit / customer_total) * 100 
    ELSE 0 
  END
WHERE customer_total IS NOT NULL;