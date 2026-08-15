-- Enable RLS on all tables that have policies but RLS is disabled
-- This fixes multiple critical security vulnerabilities

-- Critical tables with customer/business data
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;

-- Employee and payroll tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Invoice and financial tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printed_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

-- Other critical tables
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses_withdrawals ENABLE ROW LEVEL SECURITY;

-- Comment to document the security fix
COMMENT ON TABLE public.billboards IS 'RLS enabled to protect billboard data from unauthorized access';
COMMENT ON TABLE public.customers IS 'RLS enabled to protect customer PII (GDPR compliance)';
COMMENT ON TABLE public.customer_payments IS 'RLS enabled to protect financial transaction data';
COMMENT ON TABLE public.employees IS 'RLS enabled to protect employee personal and financial data';