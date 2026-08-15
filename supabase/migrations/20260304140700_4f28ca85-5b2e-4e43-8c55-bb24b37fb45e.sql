
-- إعادة حساب تكاليف التركيب في composite_tasks من installation_task_items + sizes
WITH install_costs AS (
  SELECT
    ct.id AS composite_id,
    COALESCE(SUM(iti.customer_installation_cost), 0) AS calc_customer_install,
    COALESCE(SUM(
      CASE
        WHEN iti.company_installation_cost IS NOT NULL AND iti.company_installation_cost > 0
          THEN iti.company_installation_cost
        ELSE
          CASE
            WHEN COALESCE(iti.faces_to_install, b."Faces_Count", 2) = 1
              THEN COALESCE(s.installation_price, 0) / 2
            ELSE COALESCE(s.installation_price, 0) * COALESCE(iti.faces_to_install, b."Faces_Count", 2) / 2
          END
      END
    ), 0) AS calc_company_install
  FROM composite_tasks ct
  JOIN installation_task_items iti ON iti.task_id = ct.installation_task_id
  JOIN billboards b ON b."ID" = iti.billboard_id
  LEFT JOIN sizes s ON s.name = b."Size"
  WHERE ct.installation_task_id IS NOT NULL
  GROUP BY ct.id
),
print_costs AS (
  SELECT
    ct.id AS composite_id,
    COALESCE(pt.customer_total_amount, 0) AS calc_customer_print,
    COALESCE(pt.total_cost, 0) AS calc_company_print
  FROM composite_tasks ct
  JOIN print_tasks pt ON pt.id = ct.print_task_id
  WHERE ct.print_task_id IS NOT NULL
),
cutout_costs AS (
  SELECT
    ct.id AS composite_id,
    COALESCE(cot.customer_total_amount, 0) AS calc_customer_cutout,
    COALESCE(cot.total_cost, 0) AS calc_company_cutout
  FROM composite_tasks ct
  JOIN cutout_tasks cot ON cot.id = ct.cutout_task_id
  WHERE ct.cutout_task_id IS NOT NULL
),
recalc AS (
  SELECT
    ct.id,
    COALESCE(ic.calc_customer_install, ct.customer_installation_cost, 0) AS new_customer_install,
    COALESCE(ic.calc_company_install, ct.company_installation_cost, 0) AS new_company_install,
    COALESCE(pc.calc_customer_print, ct.customer_print_cost, 0) AS new_customer_print,
    COALESCE(pc.calc_company_print, ct.company_print_cost, 0) AS new_company_print,
    COALESCE(cc.calc_customer_cutout, ct.customer_cutout_cost, 0) AS new_customer_cutout,
    COALESCE(cc.calc_company_cutout, ct.company_cutout_cost, 0) AS new_company_cutout,
    COALESCE(ct.discount_amount, 0) AS discount
  FROM composite_tasks ct
  LEFT JOIN install_costs ic ON ic.composite_id = ct.id
  LEFT JOIN print_costs pc ON pc.composite_id = ct.id
  LEFT JOIN cutout_costs cc ON cc.composite_id = ct.id
)
UPDATE composite_tasks ct SET
  customer_installation_cost = r.new_customer_install,
  company_installation_cost = r.new_company_install,
  customer_print_cost = r.new_customer_print,
  company_print_cost = r.new_company_print,
  customer_cutout_cost = r.new_customer_cutout,
  company_cutout_cost = r.new_company_cutout,
  customer_total = (r.new_customer_install + r.new_customer_print + r.new_customer_cutout) - r.discount,
  company_total = r.new_company_install + r.new_company_print + r.new_company_cutout,
  net_profit = ((r.new_customer_install + r.new_customer_print + r.new_customer_cutout) - r.discount)
             - (r.new_company_install + r.new_company_print + r.new_company_cutout),
  profit_percentage = CASE
    WHEN (r.new_customer_install + r.new_customer_print + r.new_customer_cutout - r.discount) > 0
    THEN (
      ((r.new_customer_install + r.new_customer_print + r.new_customer_cutout - r.discount)
       - (r.new_company_install + r.new_company_print + r.new_company_cutout))
      / (r.new_customer_install + r.new_customer_print + r.new_customer_cutout - r.discount)
    ) * 100
    ELSE 0
  END,
  updated_at = now()
FROM recalc r
WHERE ct.id = r.id
  AND (
    ct.customer_installation_cost IS DISTINCT FROM r.new_customer_install
    OR ct.company_installation_cost IS DISTINCT FROM r.new_company_install
    OR ct.customer_print_cost IS DISTINCT FROM r.new_customer_print
    OR ct.company_print_cost IS DISTINCT FROM r.new_company_print
    OR ct.customer_cutout_cost IS DISTINCT FROM r.new_customer_cutout
    OR ct.company_cutout_cost IS DISTINCT FROM r.new_company_cutout
  );
