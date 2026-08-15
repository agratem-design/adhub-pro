-- Critical Security Fixes Migration
-- This migration addresses all critical security vulnerabilities

-- 1. Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Fix users table - Remove all public access policies
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.users;
DROP POLICY IF EXISTS "users_all" ON public.users;

-- Restrict users table to authenticated users only
CREATE POLICY "Users view own data" ON public.users
FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins view all users" ON public.users
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage users" ON public.users
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Fix customers table - Remove public access
DROP POLICY IF EXISTS "Allow all operations" ON public.customers;
DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow insert to anon" ON public.customers;
DROP POLICY IF EXISTS "Allow read to anon" ON public.customers;
DROP POLICY IF EXISTS "Allow update to anon" ON public.customers;
DROP POLICY IF EXISTS "customers_read" ON public.customers;

CREATE POLICY "Authenticated users view customers" ON public.customers
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users manage customers" ON public.customers
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5. Fix Contract table - Remove public access
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Contract";
DROP POLICY IF EXISTS "Enable insert access for all users" ON public."Contract";
DROP POLICY IF EXISTS "Enable update access for all users" ON public."Contract";
DROP POLICY IF EXISTS "Enable delete access for all users" ON public."Contract";
DROP POLICY IF EXISTS "contracts_all" ON public."Contract";
DROP POLICY IF EXISTS "contract_read" ON public."Contract";
DROP POLICY IF EXISTS "auth_insert_contract" ON public."Contract";
DROP POLICY IF EXISTS "auth_update_contract" ON public."Contract";
DROP POLICY IF EXISTS "auth_delete_contract" ON public."Contract";
DROP POLICY IF EXISTS "allow_update_admin" ON public."Contract";

CREATE POLICY "Authenticated users view contracts" ON public."Contract"
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage contracts" ON public."Contract"
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 6. Fix customer_payments table
DROP POLICY IF EXISTS "Allow all operations" ON public.customer_payments;
DROP POLICY IF EXISTS "cp_read" ON public.customer_payments;
DROP POLICY IF EXISTS "cp_ins" ON public.customer_payments;
DROP POLICY IF EXISTS "cp_upd" ON public.customer_payments;
DROP POLICY IF EXISTS "cp_del" ON public.customer_payments;
DROP POLICY IF EXISTS "read payments" ON public.customer_payments;
DROP POLICY IF EXISTS "insert payments" ON public.customer_payments;
DROP POLICY IF EXISTS "update payments" ON public.customer_payments;

CREATE POLICY "Authenticated users view payments" ON public.customer_payments
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage payments" ON public.customer_payments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 7. Fix employees table
DROP POLICY IF EXISTS "Allow all operations on employees" ON public.employees;

CREATE POLICY "Admins view employees" ON public.employees
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage employees" ON public.employees
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 8. Fix payroll tables
DROP POLICY IF EXISTS "Allow all operations on payroll_items" ON public.payroll_items;
DROP POLICY IF EXISTS "Allow all operations on payroll_runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Allow all operations on employee_contracts" ON public.employee_contracts;
DROP POLICY IF EXISTS "Allow all operations on employee_advances" ON public.employee_advances;
DROP POLICY IF EXISTS "Allow all operations on employee_deductions" ON public.employee_deductions;

CREATE POLICY "Admins manage payroll" ON public.payroll_items
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage employee contracts" ON public.employee_contracts
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage advances" ON public.employee_advances
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage deductions" ON public.employee_deductions
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 9. Fix billboards table
DROP POLICY IF EXISTS "billboards_all" ON public.billboards;

CREATE POLICY "Authenticated users view billboards" ON public.billboards
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage billboards" ON public.billboards
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- 10. Add policies to tables missing them
CREATE POLICY "Authenticated users view maintenance history" ON public.maintenance_history
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage maintenance" ON public.maintenance_history
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users view levels" ON public.levels
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage levels" ON public.levels
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view closures" ON public.account_closures
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated view profiles" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 11. Fix SECURITY DEFINER functions - Add permission checks
CREATE OR REPLACE FUNCTION public.delete_billboard(billboard_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify admin role
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  DELETE FROM billboards WHERE "ID" = billboard_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_delete_billboard(input_billboard_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_contracts BOOLEAN;
BEGIN
  -- Verify admin role
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM "Contract" 
    WHERE billboard_id = input_billboard_id 
    AND "End Date" >= CURRENT_DATE
  ) INTO has_active_contracts;
  
  IF has_active_contracts THEN
    RAISE EXCEPTION 'لا يمكن حذف اللوحة - توجد عقود نشطة مرتبطة بها';
    RETURN FALSE;
  END IF;
  
  DELETE FROM "Contract" WHERE billboard_id = input_billboard_id;
  DELETE FROM billboards WHERE "ID" = input_billboard_id;
  
  RETURN TRUE;
END;
$$;