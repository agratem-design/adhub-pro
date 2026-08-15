
-- Fix the printer_accounts view to avoid cross-join multiplication
CREATE OR REPLACE VIEW public.printer_accounts AS
SELECT 
  p.id AS printer_id,
  p.name AS printer_name,
  NULL::uuid AS customer_id,
  NULL::text AS customer_name,
  COALESCE(pt_agg.total_print_costs, 0) AS total_print_costs,
  COALESCE(ct_agg.total_cutout_costs, 0) AS total_cutout_costs,
  COALESCE(pt_agg.total_print_costs, 0) + COALESCE(ct_agg.total_cutout_costs, 0) AS total_supplier_debt,
  COALESCE(pp_agg.total_payments, 0) AS total_payments_to_printer,
  0 AS total_customer_debt,
  0 AS total_customer_payments,
  COALESCE(pt_agg.total_print_costs, 0) + COALESCE(ct_agg.total_cutout_costs, 0) - COALESCE(pp_agg.total_payments, 0) AS final_balance,
  COALESCE(pt_agg.tasks_count, 0) AS print_tasks_count,
  COALESCE(ct_agg.tasks_count, 0) AS cutout_tasks_count
FROM printers p
LEFT JOIN (
  SELECT printer_id, SUM(total_cost) AS total_print_costs, COUNT(*) AS tasks_count
  FROM print_tasks
  GROUP BY printer_id
) pt_agg ON pt_agg.printer_id = p.id
LEFT JOIN (
  SELECT printer_id, SUM(total_cost) AS total_cutout_costs, COUNT(*) AS tasks_count
  FROM cutout_tasks
  GROUP BY printer_id
) ct_agg ON ct_agg.printer_id = p.id
LEFT JOIN (
  SELECT printer_id, SUM(amount) AS total_payments
  FROM printer_payments
  GROUP BY printer_id
) pp_agg ON pp_agg.printer_id = p.id;
