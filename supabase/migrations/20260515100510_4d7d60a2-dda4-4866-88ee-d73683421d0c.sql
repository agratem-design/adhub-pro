
-- ============================================================
-- 1. CUSTOMERS: drop blanket authenticated SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users view customers" ON public.customers;
-- existing "Users with permission can view customers" + admin ALL remain

-- ============================================================
-- 2. EMPLOYEES: remove redundant {public} ALL, restrict reads
-- ============================================================
DROP POLICY IF EXISTS "Employees access" ON public.employees;
-- already have:
--   "Admins manage employees" (admin ALL, authenticated)
--   "Users with permission can manage employees" (admin OR employees perm, authenticated)
--   "Auth users with salaries or expenses permission can access" SELECT
--   "Admins view employees" SELECT
-- That set is correctly scoped already.

-- ============================================================
-- 3. EMPLOYEE_ADVANCES & EMPLOYEE_DEDUCTIONS: drop true SELECT
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view employee_advances" ON public.employee_advances;
DROP POLICY IF EXISTS "Authenticated can view employee_deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Admins manage deductions" ON public.employee_deductions; -- {public} duplicate

CREATE POLICY "Read employee_advances by admin or salaries/custody"
ON public.employee_advances FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_permission(auth.uid(), 'salaries'::text)
  OR has_permission(auth.uid(), 'custody'::text)
);

CREATE POLICY "Read employee_deductions by admin or salaries/custody"
ON public.employee_deductions FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_permission(auth.uid(), 'salaries'::text)
  OR has_permission(auth.uid(), 'custody'::text)
);

-- ============================================================
-- 4. PAYROLL: drop true SELECT, restrict to admin or salaries
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can view payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Authenticated can view payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Authenticated can view payments_salary" ON public.payments_salary;
DROP POLICY IF EXISTS "Admins manage payroll" ON public.payroll_items;          -- {public} duplicate
DROP POLICY IF EXISTS "Admins manage payroll runs" ON public.payroll_runs;       -- {public} duplicate
DROP POLICY IF EXISTS "Admins manage salary payments" ON public.payments_salary; -- {public} duplicate
DROP POLICY IF EXISTS "Admins manage employee contracts" ON public.employee_contracts; -- {public} duplicate

CREATE POLICY "Read payroll_items by admin or salaries"
ON public.payroll_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'salaries'::text));

CREATE POLICY "Read payroll_runs by admin or salaries"
ON public.payroll_runs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'salaries'::text));

CREATE POLICY "Read payments_salary by admin or salaries"
ON public.payments_salary FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'salaries'::text));

CREATE POLICY "Read employee_contracts by admin or salaries/employees"
ON public.employee_contracts FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_permission(auth.uid(), 'salaries'::text)
  OR has_permission(auth.uid(), 'employees'::text)
);

-- Recreate admin-manage on employee_contracts (we dropped {public} version above)
CREATE POLICY "Admins manage employee_contracts auth"
ON public.employee_contracts FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 5. PARTNERS: drop blanket SELECT, admins only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users view partners" ON public.partners;
-- "Admins manage partners" remains (covers SELECT for admins)

-- ============================================================
-- 6. ACTIVITY_LOG: drop true SELECT, admins only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read activity_log" ON public.activity_log;

CREATE POLICY "Read activity_log by admin"
ON public.activity_log FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 7. CONTRACT_HISTORY: drop true SELECT, admin or contracts perm
-- ============================================================
DROP POLICY IF EXISTS "auth read contract_history" ON public.contract_history;

CREATE POLICY "Read contract_history by admin or contracts"
ON public.contract_history FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'contracts'::text));

-- ============================================================
-- 8. MESSAGING_API_SETTINGS: explicit admin-only SELECT
-- ============================================================
CREATE POLICY "Read messaging_api_settings by admin"
ON public.messaging_api_settings FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 9. TIMESHEETS: explicit admin-only SELECT
-- ============================================================
DROP POLICY IF EXISTS "Timesheets access" ON public.timesheets; -- {public} variant

CREATE POLICY "Manage timesheets by admin"
ON public.timesheets FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 10. EXPENSES_WITHDRAWALS: explicit SELECT (mirrors ALL gate)
-- ============================================================
CREATE POLICY "Read expenses_withdrawals by admin or expenses/custody"
ON public.expenses_withdrawals FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_permission(auth.uid(), 'expenses'::text)
  OR has_permission(auth.uid(), 'custody'::text)
);

-- ============================================================
-- 11. PROFILES: drop redundant {public} role policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile access" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by user and admin" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Admins manage all profiles auth"
ON public.profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 12. CUSTODY_*: drop redundant {public} role policies
-- ============================================================
DROP POLICY IF EXISTS "Admins view all custody accounts" ON public.custody_accounts;
DROP POLICY IF EXISTS "Custody accounts access" ON public.custody_accounts;
DROP POLICY IF EXISTS "Custody expenses access" ON public.custody_expenses;
DROP POLICY IF EXISTS "Admins view all custody transactions" ON public.custody_transactions;
DROP POLICY IF EXISTS "Custody transactions access" ON public.custody_transactions;
-- "Users with permission can manage custody_*" (authenticated) remain
