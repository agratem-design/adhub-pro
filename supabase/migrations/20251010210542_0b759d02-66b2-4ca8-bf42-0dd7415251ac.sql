-- إضافة RLS policies للجداول المتعلقة بالمصروفات والرواتب

-- ✅ Enable RLS on expenses table
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ✅ Policies for expenses
CREATE POLICY "Allow all operations on expenses" 
ON public.expenses 
FOR ALL 
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on employees table  
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ✅ Policies for employees
CREATE POLICY "Allow all operations on employees"
ON public.employees
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on payroll_runs
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on payroll_runs"
ON public.payroll_runs
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on payroll_items
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on payroll_items"
ON public.payroll_items
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on payments_salary
ALTER TABLE public.payments_salary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on payments_salary"
ON public.payments_salary
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on employee_contracts
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on employee_contracts"
ON public.employee_contracts
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on employee_advances
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on employee_advances"
ON public.employee_advances
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on employee_deductions
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on employee_deductions"
ON public.employee_deductions
FOR ALL
USING (true)
WITH CHECK (true);

-- ✅ Enable RLS on expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on expense_categories"
ON public.expense_categories
FOR ALL
USING (true)
WITH CHECK (true);