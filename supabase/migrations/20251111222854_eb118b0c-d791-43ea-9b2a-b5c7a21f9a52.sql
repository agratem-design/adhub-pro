-- =====================================================
-- CRITICAL SECURITY FIX: Drop All "Allow All" Policies
-- =====================================================

-- Drop "Allow all" policies from 20 tables
DROP POLICY IF EXISTS "Allow all for Contract" ON "Contract";
DROP POLICY IF EXISTS "Allow all for customers" ON customers;
DROP POLICY IF EXISTS "Allow all for customer_payments" ON customer_payments;
DROP POLICY IF EXISTS "Allow all for billboards" ON billboards;
DROP POLICY IF EXISTS "Allow all for period_closures" ON period_closures;
DROP POLICY IF EXISTS "Allow all for print_invoice_payments" ON print_invoice_payments;
DROP POLICY IF EXISTS "Allow all for print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Allow all for print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Allow all for printers" ON printers;
DROP POLICY IF EXISTS "Allow all for purchase_invoice_items" ON purchase_invoice_items;
DROP POLICY IF EXISTS "Allow all for purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Allow all for purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow all for report_items" ON report_items;
DROP POLICY IF EXISTS "Allow all for reports" ON reports;
DROP POLICY IF EXISTS "Allow all for sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Allow all for sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow all for shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Allow all for system_settings" ON system_settings;
DROP POLICY IF EXISTS "Allow all for tasks" ON tasks;
DROP POLICY IF EXISTS "Allow all for template_settings" ON template_settings;

-- =====================================================
-- Add Missing RLS Policies to 6 Tables
-- =====================================================

-- expenses_flags: Admin-only access
CREATE POLICY "Admins manage expenses_flags" ON expenses_flags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- messaging_api_settings: Admin-only access (sensitive API credentials)
CREATE POLICY "Admins manage messaging_api_settings" ON messaging_api_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- print_installation_pricing: Admins manage, all authenticated users can view
CREATE POLICY "Admins manage print_installation_pricing" ON print_installation_pricing
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users view print_installation_pricing" ON print_installation_pricing
  FOR SELECT TO authenticated
  USING (true);

-- shared_transactions: Admins manage, all authenticated users can view
CREATE POLICY "Admins manage shared_transactions" ON shared_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users view shared_transactions" ON shared_transactions
  FOR SELECT TO authenticated
  USING (true);

-- timesheets: Admins manage, users view their own
CREATE POLICY "Admins manage timesheets" ON timesheets
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own timesheets" ON timesheets
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- withdrawals: Admin-only access (financial data)
CREATE POLICY "Admins manage withdrawals" ON withdrawals
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =====================================================
-- Fix Security Definer Views
-- =====================================================

-- Drop and recreate customer_financial_summary as SECURITY INVOKER
DROP VIEW IF EXISTS customer_financial_summary;
CREATE OR REPLACE VIEW customer_financial_summary
WITH (security_invoker = true)
AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  COALESCE(SUM(COALESCE(ct."Total", 0)), 0) as total_contracts,
  COALESCE(SUM(COALESCE(pi.total_amount, 0)), 0) as total_printed_invoices,
  COALESCE(SUM(COALESCE(si.total_amount, 0)), 0) as total_sales_invoices,
  COALESCE(SUM(COALESCE(cp.amount, 0)), 0) as total_paid,
  COALESCE(SUM(COALESCE(pur.total_price, 0)), 0) as total_purchases,
  COALESCE(SUM(COALESCE(ct."Total", 0)), 0) + 
  COALESCE(SUM(COALESCE(pi.total_amount, 0)), 0) + 
  COALESCE(SUM(COALESCE(si.total_amount, 0)), 0) as total_due,
  COALESCE(SUM(COALESCE(cp.amount, 0)), 0) - 
  (COALESCE(SUM(COALESCE(ct."Total", 0)), 0) + 
   COALESCE(SUM(COALESCE(pi.total_amount, 0)), 0) + 
   COALESCE(SUM(COALESCE(si.total_amount, 0)), 0)) as balance
FROM customers c
LEFT JOIN "Contract" ct ON ct.customer_id = c.id
LEFT JOIN printed_invoices pi ON pi.customer_id = c.id
LEFT JOIN sales_invoices si ON si.customer_id = c.id
LEFT JOIN customer_payments cp ON cp.customer_id = c.id
LEFT JOIN customer_purchases pur ON pur.customer_id = c.id
GROUP BY c.id, c.name;

-- Drop and recreate customer_financials as SECURITY INVOKER
DROP VIEW IF EXISTS customer_financials;
CREATE OR REPLACE VIEW customer_financials
WITH (security_invoker = true)
AS
SELECT 
  c.id as customer_id,
  c.name,
  c.created_at,
  c.updated_at,
  c.last_payment_date,
  COUNT(DISTINCT ct."Contract_Number") as contracts_count,
  COALESCE(SUM(COALESCE(ct."Total", 0)), 0) as total_contracts_amount,
  COALESCE(SUM(COALESCE(CAST(ct."Total Paid" AS numeric), 0)), 0) as total_paid,
  COALESCE(SUM(COALESCE(ct."Total", 0)), 0) - 
  COALESCE(SUM(COALESCE(CAST(ct."Total Paid" AS numeric), 0)), 0) as total_remaining
FROM customers c
LEFT JOIN "Contract" ct ON ct.customer_id = c.id
GROUP BY c.id, c.name, c.created_at, c.updated_at, c.last_payment_date;

-- Drop and recreate shared_beneficiary_summary as SECURITY INVOKER
DROP VIEW IF EXISTS shared_beneficiary_summary;
CREATE OR REPLACE VIEW shared_beneficiary_summary
WITH (security_invoker = true)
AS
SELECT 
  beneficiary,
  SUM(CASE WHEN type IN ('rental_income', 'capital_deduction') THEN amount ELSE 0 END) as total_due,
  SUM(CASE WHEN type = 'payout' THEN amount ELSE 0 END) as total_paid
FROM shared_transactions
GROUP BY beneficiary;