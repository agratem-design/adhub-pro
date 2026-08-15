-- إكمال تحسين سياسات RLS - جداول profiles و customers و customer_payments

-- 4. تحسين سياسات جدول profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile or admins" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(), 'admin'::app_role));

-- 5. تحسين سياسات جدول customers
DROP POLICY IF EXISTS "Admins can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;

CREATE POLICY "Admins can insert customers" ON public.customers
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update customers" ON public.customers
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. تحسين سياسات جدول customer_payments
DROP POLICY IF EXISTS "Admins can insert customer_payments" ON public.customer_payments;
DROP POLICY IF EXISTS "Admins can update customer_payments" ON public.customer_payments;

CREATE POLICY "Admins can insert customer_payments" ON public.customer_payments
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update customer_payments" ON public.customer_payments
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));