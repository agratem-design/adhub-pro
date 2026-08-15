-- 1. Fix Security Definer Views - Recreate them with SECURITY INVOKER

-- Drop and recreate billboard_partnership_status view
DROP VIEW IF EXISTS public.billboard_partnership_status;
CREATE VIEW public.billboard_partnership_status
WITH (security_invoker = true)
AS
SELECT b."ID" AS billboard_id,
    b."Billboard_Name" AS billboard_name,
    b.is_partnership,
    b.capital,
    b.capital_remaining,
    count(sb.id) AS partners_count,
    COALESCE(sum(sb.capital_contribution), (0)::numeric) AS total_capital_contributions,
    COALESCE(sum(sb.capital_remaining), (0)::numeric) AS total_capital_remaining,
    COALESCE(sum(sb.reserved_amount), (0)::numeric) AS total_reserved,
    COALESCE(sum(sb.confirmed_amount), (0)::numeric) AS total_confirmed,
    array_agg(jsonb_build_object('partner_id', sb.partner_company_id, 'partner_name', p.name, 'capital_contribution', sb.capital_contribution, 'capital_remaining', sb.capital_remaining, 'reserved_amount', sb.reserved_amount, 'confirmed_amount', sb.confirmed_amount, 'pre_pct', sb.partner_pre_pct, 'post_pct', sb.partner_post_pct)) FILTER (WHERE (sb.id IS NOT NULL)) AS partners
FROM ((billboards b
    LEFT JOIN shared_billboards sb ON (((sb.billboard_id = b."ID") AND (sb.status = 'active'::text))))
    LEFT JOIN partners p ON ((p.id = sb.partner_company_id)))
WHERE (b.is_partnership = true)
GROUP BY b."ID", b."Billboard_Name", b.is_partnership, b.capital, b.capital_remaining;

-- Drop and recreate friend_company_financials view
DROP VIEW IF EXISTS public.friend_company_financials;
CREATE VIEW public.friend_company_financials
WITH (security_invoker = true)
AS
SELECT fc.id AS company_id,
    fc.name AS company_name,
    count(DISTINCT fbr.billboard_id) AS total_billboards,
    count(DISTINCT fbr.contract_number) AS total_contracts,
    COALESCE(sum(fbr.friend_rental_cost), (0)::numeric) AS total_paid_to_friend,
    COALESCE(sum(fbr.customer_rental_price), (0)::numeric) AS total_revenue_from_customers,
    COALESCE(sum(fbr.profit), (0)::numeric) AS total_profit,
    min(fbr.start_date) AS first_rental_date,
    max(fbr.end_date) AS last_rental_date
FROM (friend_companies fc
    LEFT JOIN friend_billboard_rentals fbr ON ((fc.id = fbr.friend_company_id)))
GROUP BY fc.id, fc.name;

-- Drop and recreate payroll_summary view
DROP VIEW IF EXISTS public.payroll_summary;
CREATE VIEW public.payroll_summary
WITH (security_invoker = true)
AS
SELECT pr.id AS payroll_id,
    pr.period_start,
    pr.period_end,
    sum(((pi.basic_salary + pi.allowances) + pi.overtime_amount)) AS total_gross,
    sum(pi.allowances) AS total_allowances,
    sum((((pi.deductions + pi.advances_deduction) + COALESCE(pi.tax, (0)::numeric)) + COALESCE(pi.social_security, (0)::numeric))) AS total_deductions,
    sum(pi.net_salary) AS total_net,
    sum(
        CASE
            WHEN pi.paid THEN pi.net_salary
            ELSE (0)::numeric
        END) AS total_paid
FROM (payroll_runs pr
    JOIN payroll_items pi ON ((pi.payroll_id = pr.id)))
GROUP BY pr.id, pr.period_start, pr.period_end;

-- Drop and recreate print_invoices_standalone view
DROP VIEW IF EXISTS public.print_invoices_standalone;
CREATE VIEW public.print_invoices_standalone
WITH (security_invoker = true)
AS
SELECT id,
    contract_number,
    invoice_number,
    customer_id,
    customer_name,
    printer_name,
    invoice_date,
    total_amount,
    notes,
    design_face_a_path,
    design_face_b_path,
    created_at,
    updated_at,
    account_payments_deducted,
    contract_numbers,
    currency_code,
    "currency_symbol'",
    invoice_type,
    items,
    subtotal,
    discount,
    discount_type,
    discount_amount,
    total,
    currency_symbol,
    include_account_balance,
    print_items,
    payment_method,
    account_deduction,
    paid,
    paid_amount,
    paid_at,
    locked,
    printer_id,
    printer_cost,
    composite_task_id
FROM printed_invoices pi
WHERE ((composite_task_id IS NULL) OR (NOT (EXISTS ( SELECT 1
        FROM print_tasks pt
        WHERE ((pt.invoice_id = pi.id) AND (pt.is_composite = true))))));

-- Drop and recreate printer_accounts view
DROP VIEW IF EXISTS public.printer_accounts;
CREATE VIEW public.printer_accounts
WITH (security_invoker = true)
AS
SELECT p.id AS printer_id,
    p.name AS printer_name,
    c.id AS customer_id,
    c.name AS customer_name,
    COALESCE(sum(pt.total_cost), (0)::numeric) AS total_print_costs,
    COALESCE(sum(ctt.total_cost), (0)::numeric) AS total_cutout_costs,
    (COALESCE(sum(pt.total_cost), (0)::numeric) + COALESCE(sum(ctt.total_cost), (0)::numeric)) AS total_supplier_debt,
    COALESCE(( SELECT sum(cp.amount) AS sum
        FROM customer_payments cp
        WHERE ((cp.customer_id = c.id) AND (cp.entry_type = 'payment'::text) AND (cp.amount > (0)::numeric))), (0)::numeric) AS total_payments_to_printer,
    COALESCE(( SELECT sum(con."Total") AS sum
        FROM "Contract" con
        WHERE (con.customer_id = c.id)), (0)::numeric) AS total_customer_debt,
    COALESCE(( SELECT sum(abs(cp.amount)) AS sum
        FROM customer_payments cp
        WHERE ((cp.customer_id = c.id) AND (cp.entry_type = ANY (ARRAY['receipt'::text, 'payment'::text])) AND (cp.amount < (0)::numeric))), (0)::numeric) AS total_customer_payments,
    (((COALESCE(sum(pt.total_cost), (0)::numeric) + COALESCE(sum(ctt.total_cost), (0)::numeric)) - COALESCE(( SELECT sum(cp.amount) AS sum
        FROM customer_payments cp
        WHERE ((cp.customer_id = c.id) AND (cp.entry_type = 'payment'::text) AND (cp.amount > (0)::numeric))), (0)::numeric)) - (COALESCE(( SELECT sum(con."Total") AS sum
        FROM "Contract" con
        WHERE (con.customer_id = c.id)), (0)::numeric) - COALESCE(( SELECT sum(abs(cp.amount)) AS sum
        FROM customer_payments cp
        WHERE ((cp.customer_id = c.id) AND (cp.entry_type = ANY (ARRAY['receipt'::text, 'payment'::text])) AND (cp.amount < (0)::numeric))), (0)::numeric))) AS final_balance,
    count(DISTINCT pt.id) AS print_tasks_count,
    count(DISTINCT ctt.id) AS cutout_tasks_count
FROM (((printers p
    LEFT JOIN customers c ON ((c.printer_id = p.id)))
    LEFT JOIN print_tasks pt ON ((pt.printer_id = p.id)))
    LEFT JOIN cutout_tasks ctt ON ((ctt.printer_id = p.id)))
GROUP BY p.id, p.name, c.id, c.name;

-- Drop and recreate team_accounts_summary view
DROP VIEW IF EXISTS public.team_accounts_summary;
CREATE VIEW public.team_accounts_summary
WITH (security_invoker = true)
AS
SELECT ta.team_id,
    t.team_name,
    count(*) AS total_installations,
    count(*) FILTER (WHERE (ta.status = 'pending'::text)) AS pending_count,
    count(*) FILTER (WHERE (ta.status = 'paid'::text)) AS paid_count,
    COALESCE(sum(COALESCE(s.installation_price, (0)::bigint)) FILTER (WHERE (ta.status = 'pending'::text)), (0)::numeric) AS pending_amount,
    COALESCE(sum(COALESCE(s.installation_price, (0)::bigint)) FILTER (WHERE (ta.status = 'paid'::text)), (0)::numeric) AS paid_amount,
    COALESCE(sum(COALESCE(s.installation_price, (0)::bigint)), (0)::numeric) AS total_amount
FROM (((installation_team_accounts ta
    LEFT JOIN installation_teams t ON ((ta.team_id = t.id)))
    LEFT JOIN billboards b ON ((ta.billboard_id = b."ID")))
    LEFT JOIN sizes s ON ((b."Size" = s.name)))
GROUP BY ta.team_id, t.team_name;

-- 2. Enable RLS on partnership_contract_shares table
ALTER TABLE public.partnership_contract_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for partnership_contract_shares
CREATE POLICY "Allow authenticated users to view partnership_contract_shares"
ON public.partnership_contract_shares
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert partnership_contract_shares"
ON public.partnership_contract_shares
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update partnership_contract_shares"
ON public.partnership_contract_shares
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete partnership_contract_shares"
ON public.partnership_contract_shares
FOR DELETE
TO authenticated
USING (true);