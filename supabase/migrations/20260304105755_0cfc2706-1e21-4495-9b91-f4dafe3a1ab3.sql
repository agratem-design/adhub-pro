
-- Fix auth_rls_initplan performance warnings
-- Wrap auth.uid() with (select auth.uid()) in all affected policies

-- 1. billboard_print_settings
DROP POLICY IF EXISTS "Authenticated users can manage billboard print settings" ON public.billboard_print_settings;
CREATE POLICY "Authenticated users can manage billboard print settings" ON public.billboard_print_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. purchase_invoices
DROP POLICY IF EXISTS "Users with permission can view purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Users with permission can view purchase_invoices" ON public.purchase_invoices FOR SELECT TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'purchases')
);

DROP POLICY IF EXISTS "Users with permission can manage purchase_invoices" ON public.purchase_invoices;
CREATE POLICY "Users with permission can manage purchase_invoices" ON public.purchase_invoices FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'purchases')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'purchases')
);

-- 3. custody_accounts
DROP POLICY IF EXISTS "Users with permission can manage custody_accounts" ON public.custody_accounts;
CREATE POLICY "Users with permission can manage custody_accounts" ON public.custody_accounts FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
);

-- 4. custody_expenses
DROP POLICY IF EXISTS "Users with permission can manage custody_expenses" ON public.custody_expenses;
CREATE POLICY "Users with permission can manage custody_expenses" ON public.custody_expenses FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
);

-- 5. custody_transactions
DROP POLICY IF EXISTS "Users with permission can manage custody_transactions" ON public.custody_transactions;
CREATE POLICY "Users with permission can manage custody_transactions" ON public.custody_transactions FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody')
);

-- 6. billboard_history
DROP POLICY IF EXISTS "Permitted users can insert billboard history" ON public.billboard_history;
CREATE POLICY "Permitted users can insert billboard history" ON public.billboard_history FOR INSERT TO authenticated WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
);

DROP POLICY IF EXISTS "Permitted users can update billboard history" ON public.billboard_history;
CREATE POLICY "Permitted users can update billboard history" ON public.billboard_history FOR UPDATE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
);

-- 7. base_prices
DROP POLICY IF EXISTS "Permitted users can manage base_prices" ON public.base_prices;
CREATE POLICY "Permitted users can manage base_prices" ON public.base_prices FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'pricing')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'pricing')
);

-- 8. customer_payments - multiple policies
DROP POLICY IF EXISTS "Admins can delete payments" ON public.customer_payments;
CREATE POLICY "Admins can delete payments" ON public.customer_payments FOR DELETE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users with permission can manage customer_payments" ON public.customer_payments;
CREATE POLICY "Users with permission can manage customer_payments" ON public.customer_payments FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'payments')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'payments')
);

DROP POLICY IF EXISTS "Admins can insert customer_payments" ON public.customer_payments;
CREATE POLICY "Admins can insert customer_payments" ON public.customer_payments FOR INSERT TO authenticated WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can update customer_payments" ON public.customer_payments;
CREATE POLICY "Admins can update customer_payments" ON public.customer_payments FOR UPDATE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 9. printed_invoices
DROP POLICY IF EXISTS "Users with permission can manage printed_invoices" ON public.printed_invoices;
CREATE POLICY "Users with permission can manage printed_invoices" ON public.printed_invoices FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'invoices')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'invoices')
);

-- 10. contract_expenses
DROP POLICY IF EXISTS "Users with permission can manage contract_expenses" ON public.contract_expenses;
CREATE POLICY "Users with permission can manage contract_expenses" ON public.contract_expenses FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 11. employees
DROP POLICY IF EXISTS "Users with permission can manage employees" ON public.employees;
CREATE POLICY "Users with permission can manage employees" ON public.employees FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'employees')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'employees')
);

DROP POLICY IF EXISTS "Authenticated users with salaries or expenses permission can ac" ON public.employees;
CREATE POLICY "Auth users with salaries or expenses permission can access" ON public.employees FOR SELECT TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'salaries') OR public.has_permission((select auth.uid()), 'expenses')
);

DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 12. expense_categories
DROP POLICY IF EXISTS "Users with expenses permission can access expense categories" ON public.expense_categories;
CREATE POLICY "Users with expenses permission can access expense categories" ON public.expense_categories FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
);

-- 13. employee_advances
DROP POLICY IF EXISTS "Users with custody or salaries permission can access advances" ON public.employee_advances;
CREATE POLICY "Users with custody or salaries permission can access advances" ON public.employee_advances FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody') OR public.has_permission((select auth.uid()), 'salaries')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'custody') OR public.has_permission((select auth.uid()), 'salaries')
);

-- 14. printer_payments
DROP POLICY IF EXISTS "Authenticated users can view printer payments" ON public.printer_payments;
CREATE POLICY "Authenticated users can view printer payments" ON public.printer_payments FOR SELECT TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
);

DROP POLICY IF EXISTS "Authenticated users can insert printer payments" ON public.printer_payments;
CREATE POLICY "Authenticated users can insert printer payments" ON public.printer_payments FOR INSERT TO authenticated WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
);

DROP POLICY IF EXISTS "Authenticated users can update printer payments" ON public.printer_payments;
CREATE POLICY "Authenticated users can update printer payments" ON public.printer_payments FOR UPDATE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
);

DROP POLICY IF EXISTS "Authenticated users can delete printer payments" ON public.printer_payments;
CREATE POLICY "Authenticated users can delete printer payments" ON public.printer_payments FOR DELETE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 15. sizes
DROP POLICY IF EXISTS "Users with permission can delete sizes" ON public.sizes;
CREATE POLICY "Users with permission can delete sizes" ON public.sizes FOR DELETE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users with permission can insert sizes" ON public.sizes;
CREATE POLICY "Users with permission can insert sizes" ON public.sizes FOR INSERT TO authenticated WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 16. expenses_withdrawals
DROP POLICY IF EXISTS "Authenticated users with expenses or custody permission can acc" ON public.expenses_withdrawals;
CREATE POLICY "Auth users with expenses or custody permission can access" ON public.expenses_withdrawals FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses') OR public.has_permission((select auth.uid()), 'custody')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses') OR public.has_permission((select auth.uid()), 'custody')
);

-- 17. expenses
DROP POLICY IF EXISTS "Authenticated users with expenses permission can access expense" ON public.expenses;
CREATE POLICY "Auth users with expenses permission can access expenses" ON public.expenses FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
);

DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses" ON public.expenses FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 18. period_closures
DROP POLICY IF EXISTS "Authenticated users with expenses or salaries permission can ac" ON public.period_closures;
CREATE POLICY "Auth users with expenses or salaries can access closures" ON public.period_closures FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses') OR public.has_permission((select auth.uid()), 'salaries')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses') OR public.has_permission((select auth.uid()), 'salaries')
);

-- 19. installation_tasks
DROP POLICY IF EXISTS "Users with permission can manage installation_tasks" ON public.installation_tasks;
CREATE POLICY "Users with permission can manage installation_tasks" ON public.installation_tasks FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
);

-- 20. installation_task_items
DROP POLICY IF EXISTS "Users with permission can manage installation_task_items" ON public.installation_task_items;
CREATE POLICY "Users with permission can manage installation_task_items" ON public.installation_task_items FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'installation_tasks')
);

-- 21. print_tasks
DROP POLICY IF EXISTS "Users with permission can manage print_tasks" ON public.print_tasks;
CREATE POLICY "Users with permission can manage print_tasks" ON public.print_tasks FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'print_tasks')
);

-- 22. profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (
  id = (select auth.uid())
);

DROP POLICY IF EXISTS "Users can update own profile or admins" ON public.profiles;
CREATE POLICY "Users can update own profile or admins" ON public.profiles FOR UPDATE TO authenticated USING (
  id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 23. customers
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
CREATE POLICY "Admins can insert customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers FOR UPDATE TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 24. cutout_tasks
DROP POLICY IF EXISTS "Users with permission can manage cutout_tasks" ON public.cutout_tasks;
CREATE POLICY "Users with permission can manage cutout_tasks" ON public.cutout_tasks FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'cutout_tasks')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'cutout_tasks')
);

-- 25. customer_purchases
DROP POLICY IF EXISTS "Admins manage customer_purchases" ON public.customer_purchases;
CREATE POLICY "Admins manage customer_purchases" ON public.customer_purchases FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 26. payroll_runs
DROP POLICY IF EXISTS "Admins manage payroll_runs" ON public.payroll_runs;
CREATE POLICY "Admins manage payroll_runs" ON public.payroll_runs FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 27. payroll_items
DROP POLICY IF EXISTS "Admins manage payroll_items" ON public.payroll_items;
CREATE POLICY "Admins manage payroll_items" ON public.payroll_items FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 28. payments_salary
DROP POLICY IF EXISTS "Admins manage payments_salary" ON public.payments_salary;
CREATE POLICY "Admins manage payments_salary" ON public.payments_salary FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role)
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role)
);

-- 29. expenses_flags
DROP POLICY IF EXISTS "Authenticated users with expenses permission can access expense" ON public.expenses_flags;
CREATE POLICY "Auth users with expenses permission can access flags" ON public.expenses_flags FOR ALL TO authenticated USING (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
) WITH CHECK (
  public.has_role((select auth.uid()), 'admin'::app_role) OR public.has_permission((select auth.uid()), 'expenses')
);
