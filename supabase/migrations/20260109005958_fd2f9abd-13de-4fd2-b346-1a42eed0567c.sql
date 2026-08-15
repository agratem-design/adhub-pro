-- Fix RLS policies performance issues by wrapping auth functions in SELECT

-- profiles table
DROP POLICY IF EXISTS "Profiles are viewable by user and admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Profiles are viewable by user and admin" ON public.profiles
FOR SELECT USING ((select auth.uid()) = id OR public.has_role((select auth.uid()), 'admin'));

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE USING ((select auth.uid()) = id OR public.has_role((select auth.uid()), 'admin'));

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- reports table
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.reports;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.reports;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.reports;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.reports;

CREATE POLICY "Enable read access for all authenticated users" ON public.reports
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.reports
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.reports
FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.reports
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- report_items table
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.report_items;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.report_items;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.report_items;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.report_items;

CREATE POLICY "Enable read access for all authenticated users" ON public.report_items
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.report_items
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.report_items
FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.report_items
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- users table
DROP POLICY IF EXISTS "Allow authenticated users to update profiles" ON public.users;
DROP POLICY IF EXISTS "Users view own data" ON public.users;
DROP POLICY IF EXISTS "Admins view all users" ON public.users;

CREATE POLICY "Users view own data" ON public.users
FOR SELECT USING ((select auth.uid()) = id OR public.has_role((select auth.uid()), 'admin'));

CREATE POLICY "Allow authenticated users to update profiles" ON public.users
FOR UPDATE USING ((select auth.uid()) = id);

CREATE POLICY "Admins view all users" ON public.users
FOR SELECT USING (public.has_role((select auth.uid()), 'admin'));

-- printers table
DROP POLICY IF EXISTS "Allow admins to manage printers" ON public.printers;

CREATE POLICY "Allow admins to manage printers" ON public.printers
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- tasks table
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.tasks;

CREATE POLICY "Enable read access for all authenticated users" ON public.tasks
FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.tasks
FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.tasks
FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.tasks
FOR DELETE USING ((select auth.role()) = 'authenticated');

-- user_roles table
DROP POLICY IF EXISTS "User can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "User can view own roles" ON public.user_roles
FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Admins manage roles" ON public.user_roles
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- messaging_api_settings table
DROP POLICY IF EXISTS "Admins manage messaging_api_settings" ON public.messaging_api_settings;

CREATE POLICY "Admins manage messaging_api_settings" ON public.messaging_api_settings
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- print_installation_pricing table
DROP POLICY IF EXISTS "Admins manage print_installation_pricing" ON public.print_installation_pricing;

CREATE POLICY "Admins manage print_installation_pricing" ON public.print_installation_pricing
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- printed_invoices table
DROP POLICY IF EXISTS "Allow admins to manage printed invoices" ON public.printed_invoices;

CREATE POLICY "Allow admins to manage printed invoices" ON public.printed_invoices
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- installation_team_accounts table
DROP POLICY IF EXISTS "Admins manage team accounts" ON public.installation_team_accounts;

CREATE POLICY "Admins manage team accounts" ON public.installation_team_accounts
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- custody_accounts table
DROP POLICY IF EXISTS "Admins view all custody accounts" ON public.custody_accounts;

CREATE POLICY "Admins view all custody accounts" ON public.custody_accounts
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- custody_transactions table
DROP POLICY IF EXISTS "Admins view all custody transactions" ON public.custody_transactions;

CREATE POLICY "Admins view all custody transactions" ON public.custody_transactions
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- employees table
DROP POLICY IF EXISTS "Admins view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;

CREATE POLICY "Admins manage employees" ON public.employees
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- system_settings table
DROP POLICY IF EXISTS "السماح بالتحديث للمستخدمين المسجل" ON public.system_settings;

CREATE POLICY "السماح بالتحديث للمستخدمين المسجل" ON public.system_settings
FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- payroll_items table
DROP POLICY IF EXISTS "Admins manage payroll" ON public.payroll_items;

CREATE POLICY "Admins manage payroll" ON public.payroll_items
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- payroll_runs table
DROP POLICY IF EXISTS "Admins manage payroll runs" ON public.payroll_runs;

CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- employee_contracts table
DROP POLICY IF EXISTS "Admins manage employee contracts" ON public.employee_contracts;

CREATE POLICY "Admins manage employee contracts" ON public.employee_contracts
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- employee_advances table
DROP POLICY IF EXISTS "Admins manage advances" ON public.employee_advances;

CREATE POLICY "Admins manage advances" ON public.employee_advances
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- employee_deductions table
DROP POLICY IF EXISTS "Admins manage deductions" ON public.employee_deductions;

CREATE POLICY "Admins manage deductions" ON public.employee_deductions
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- maintenance_history table
DROP POLICY IF EXISTS "Admins manage maintenance" ON public.maintenance_history;

CREATE POLICY "Admins manage maintenance" ON public.maintenance_history
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- levels table
DROP POLICY IF EXISTS "Admins manage levels" ON public.levels;

CREATE POLICY "Admins manage levels" ON public.levels
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- account_closures table
DROP POLICY IF EXISTS "Admins view closures" ON public.account_closures;

CREATE POLICY "Admins view closures" ON public.account_closures
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- Contract table
DROP POLICY IF EXISTS "Admins manage contracts" ON public."Contract";

CREATE POLICY "Admins manage contracts" ON public."Contract"
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- user_permissions table
DROP POLICY IF EXISTS "Admins manage permissions" ON public.user_permissions;

CREATE POLICY "Admins manage permissions" ON public.user_permissions
FOR ALL USING (public.has_role((select auth.uid()), 'admin'));