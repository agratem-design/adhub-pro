-- ✅ SECURITY FIX: Add trigger to prevent non-admins from assigning admin role
-- This provides server-side protection against privilege escalation

-- Create function to check admin role assignment
CREATE OR REPLACE FUNCTION public.check_admin_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to assign admin role, verify the caller is also an admin
  IF NEW.role = 'admin'::app_role THEN
    IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can assign admin role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_admin_role_assignment ON public.user_roles;

-- Create trigger to enforce admin role assignment restriction
CREATE TRIGGER enforce_admin_role_assignment
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_admin_role_assignment();

-- ✅ FIX: Update overly permissive RLS policies for sensitive tables

-- 1. Fix customer_purchases - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.customer_purchases;
DROP POLICY IF EXISTS "Admins manage customer_purchases" ON public.customer_purchases;

CREATE POLICY "Authenticated can view customer_purchases" ON public.customer_purchases
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage customer_purchases" ON public.customer_purchases
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix employees table - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.employees;
DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;

CREATE POLICY "Authenticated can view employees" ON public.employees
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage employees" ON public.employees
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix payroll_runs - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.payroll_runs;
DROP POLICY IF EXISTS "Admins manage payroll_runs" ON public.payroll_runs;

CREATE POLICY "Authenticated can view payroll_runs" ON public.payroll_runs
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage payroll_runs" ON public.payroll_runs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Fix payroll_items - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.payroll_items;
DROP POLICY IF EXISTS "Admins manage payroll_items" ON public.payroll_items;

CREATE POLICY "Authenticated can view payroll_items" ON public.payroll_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage payroll_items" ON public.payroll_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix expenses - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.expenses;
DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;

CREATE POLICY "Authenticated can view expenses" ON public.expenses
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage expenses" ON public.expenses
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. Fix payments_salary - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.payments_salary;
DROP POLICY IF EXISTS "Admins manage payments_salary" ON public.payments_salary;

CREATE POLICY "Authenticated can view payments_salary" ON public.payments_salary
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage payments_salary" ON public.payments_salary
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Fix employee_advances - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.employee_advances;
DROP POLICY IF EXISTS "Admins manage employee_advances" ON public.employee_advances;

CREATE POLICY "Authenticated can view employee_advances" ON public.employee_advances
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage employee_advances" ON public.employee_advances
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 8. Fix employee_deductions - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.employee_deductions;
DROP POLICY IF EXISTS "Admins manage employee_deductions" ON public.employee_deductions;

CREATE POLICY "Authenticated can view employee_deductions" ON public.employee_deductions
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage employee_deductions" ON public.employee_deductions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 9. Fix expense_categories - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.expense_categories;
DROP POLICY IF EXISTS "Admins manage expense_categories" ON public.expense_categories;

CREATE POLICY "Authenticated can view expense_categories" ON public.expense_categories
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage expense_categories" ON public.expense_categories
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 10. Fix print_invoice_payments - only admins can manage
DROP POLICY IF EXISTS "Allow all operations" ON public.print_invoice_payments;
DROP POLICY IF EXISTS "Admins manage print_invoice_payments" ON public.print_invoice_payments;

CREATE POLICY "Authenticated can view print_invoice_payments" ON public.print_invoice_payments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage print_invoice_payments" ON public.print_invoice_payments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));