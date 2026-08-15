-- إصلاح سياسات RLS للجداول التي تسمح للـ public بدون تصديق

-- 1. billboard_print_profiles - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "Billboard print profiles can be deleted" ON public.billboard_print_profiles;
DROP POLICY IF EXISTS "Billboard print profiles can be created" ON public.billboard_print_profiles;
DROP POLICY IF EXISTS "Billboard print profiles can be updated" ON public.billboard_print_profiles;

CREATE POLICY "Authenticated users can delete billboard print profiles" 
ON public.billboard_print_profiles 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create billboard print profiles" 
ON public.billboard_print_profiles 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update billboard print profiles" 
ON public.billboard_print_profiles 
FOR UPDATE 
TO authenticated
USING (true) WITH CHECK (true);

-- 2. cleanup_logs - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "Allow system insert to cleanup_logs" ON public.cleanup_logs;

CREATE POLICY "Authenticated users can insert cleanup_logs" 
ON public.cleanup_logs 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 3. municipalities - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "allow_delete_municipalities" ON public.municipalities;
DROP POLICY IF EXISTS "allow_insert_municipalities" ON public.municipalities;
DROP POLICY IF EXISTS "allow_update_municipalities" ON public.municipalities;

CREATE POLICY "Authenticated users can delete municipalities" 
ON public.municipalities 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert municipalities" 
ON public.municipalities 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update municipalities" 
ON public.municipalities 
FOR UPDATE 
TO authenticated
USING (true) WITH CHECK (true);

-- 4. pricing_categories - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "Enable delete for all users" ON public.pricing_categories;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.pricing_categories;
DROP POLICY IF EXISTS "Enable update for all users" ON public.pricing_categories;

CREATE POLICY "Authenticated users can delete pricing_categories" 
ON public.pricing_categories 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert pricing_categories" 
ON public.pricing_categories 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update pricing_categories" 
ON public.pricing_categories 
FOR UPDATE 
TO authenticated
USING (true) WITH CHECK (true);

-- 5. report_items - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "report_items_delete_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_insert_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_update_all" ON public.report_items;

CREATE POLICY "Authenticated users can delete report_items" 
ON public.report_items 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert report_items" 
ON public.report_items 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update report_items" 
ON public.report_items 
FOR UPDATE 
TO authenticated
USING (true) WITH CHECK (true);

-- 6. reports - تقييدها للمستخدمين المصادقين
DROP POLICY IF EXISTS "reports_delete_all" ON public.reports;
DROP POLICY IF EXISTS "reports_insert_all" ON public.reports;
DROP POLICY IF EXISTS "reports_update_all" ON public.reports;

CREATE POLICY "Authenticated users can delete reports" 
ON public.reports 
FOR DELETE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert reports" 
ON public.reports 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update reports" 
ON public.reports 
FOR UPDATE 
TO authenticated
USING (true) WITH CHECK (true);

-- 7. users table - تقييد التسجيل للمستخدمين المصادقين (التسجيل يتم عبر auth.users)
DROP POLICY IF EXISTS "Allow user registration" ON public.users;