-- Fix: Change SECURITY DEFINER views to SECURITY INVOKER

-- 1. printer_accounts
CREATE OR REPLACE VIEW public.printer_accounts WITH (security_invoker = true) AS
SELECT p.id AS printer_id,
    p.name AS printer_name,
    NULL::uuid AS customer_id,
    NULL::text AS customer_name,
    COALESCE(pt_agg.total_print_costs, 0::numeric) AS total_print_costs,
    COALESCE(ct_agg.total_cutout_costs, 0::numeric) AS total_cutout_costs,
    (COALESCE(pt_agg.total_print_costs, 0::numeric) + COALESCE(ct_agg.total_cutout_costs, 0::numeric)) AS total_supplier_debt,
    COALESCE(pp_agg.total_payments, 0::numeric) AS total_payments_to_printer,
    0 AS total_customer_debt,
    0 AS total_customer_payments,
    ((COALESCE(pt_agg.total_print_costs, 0::numeric) + COALESCE(ct_agg.total_cutout_costs, 0::numeric)) - COALESCE(pp_agg.total_payments, 0::numeric)) AS final_balance,
    COALESCE(pt_agg.tasks_count, 0::bigint) AS print_tasks_count,
    COALESCE(ct_agg.tasks_count, 0::bigint) AS cutout_tasks_count
FROM printers p
LEFT JOIN (SELECT printer_id, sum(total_cost) AS total_print_costs, count(*) AS tasks_count FROM print_tasks GROUP BY printer_id) pt_agg ON pt_agg.printer_id = p.id
LEFT JOIN (SELECT printer_id, sum(total_cost) AS total_cutout_costs, count(*) AS tasks_count FROM cutout_tasks GROUP BY printer_id) ct_agg ON ct_agg.printer_id = p.id
LEFT JOIN (SELECT printer_id, sum(amount) AS total_payments FROM printer_payments GROUP BY printer_id) pp_agg ON pp_agg.printer_id = p.id;

-- 2. contract_summary
CREATE OR REPLACE VIEW public.contract_summary WITH (security_invoker = true) AS
SELECT c."Contract_Number",
    c.id,
    c."Customer Name",
    c.customer_id,
    c.customer_category,
    c."Contract Date",
    c."End Date",
    c."Ad Type",
    c."Total Rent",
    c."Total",
    c."Discount",
    c."Total Paid",
    c."Remaining",
    c.installation_cost,
    c.print_cost,
    c.print_cost_enabled,
    c.print_price_per_meter,
    c.fee,
    c.operating_fee_rate,
    c.payment_status,
    c."Renewal Status",
    c."Print Status",
    c.billboard_ids,
    c.billboards_count,
    c.billboard_prices,
    c.billboards_data,
    c.installments_data,
    c.design_data,
    c.contract_currency,
    c.exchange_rate,
    c.billboard_id,
    c.base_rent,
    c."Duration",
    c."Phone",
    c."Company",
    c.single_face_billboards,
    c.billboards_released,
    c.installation_enabled,
    c.include_installation_in_price,
    c.include_print_in_billboard_price,
    c.include_operating_in_installation,
    c.include_operating_in_print,
    c.level_discounts,
    c.partnership_data,
    c.partnership_operating_data,
    c.partnership_operating_fee_rate,
    c.friend_rental_data,
    c.friend_rental_includes_installation,
    c.friend_rental_operating_fee_enabled,
    c.friend_rental_operating_fee_rate,
    c.installment_count,
    c.installment_interval,
    c.installment_auto_calculate,
    c.installment_distribution_type,
    c.installment_first_at_signing,
    c.installment_first_payment_amount,
    c.installment_first_payment_type,
    c."Payment 1",
    c."Payment 2",
    c."Payment 3",
    cust.phone AS customer_phone,
    cust.company AS customer_company,
    COALESCE(pay.total_paid_amount, 0::numeric) AS actual_paid,
    COALESCE(exp.total_expenses, 0::numeric) AS total_expenses
FROM "Contract" c
LEFT JOIN customers cust ON cust.id = c.customer_id
LEFT JOIN (SELECT contract_number, sum(amount) AS total_paid_amount FROM customer_payments GROUP BY contract_number) pay ON pay.contract_number = c."Contract_Number"
LEFT JOIN (SELECT contract_number, sum(amount) AS total_expenses FROM contract_expenses GROUP BY contract_number) exp ON exp.contract_number = c."Contract_Number";

-- 3. contract_billboard_summary
CREATE OR REPLACE VIEW public.contract_billboard_summary WITH (security_invoker = true) AS
SELECT c.id AS contract_id,
    c."Contract_Number",
    c."Customer Name",
    c."Contract Date" AS start_date,
    c."End Date" AS end_date,
    c."Total Rent" AS rent_cost,
    b."ID" AS billboard_id,
    b."Billboard_Name",
    b."City",
    b."Size",
    b."Status" AS billboard_status
FROM "Contract" c
JOIN billboards b ON (b."ID"::text = ANY(string_to_array(c.billboard_ids, ',')) OR b."Contract_Number" = c."Contract_Number");