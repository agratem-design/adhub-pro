
-- 1) Restrict public SELECT policies to authenticated only
-- billboard_extensions
DROP POLICY IF EXISTS "Authenticated users view billboard extensions" ON public.billboard_extensions;
CREATE POLICY "Authenticated users view billboard extensions"
  ON public.billboard_extensions FOR SELECT
  TO authenticated USING (true);

-- cutout_tasks / cutout_task_items
DROP POLICY IF EXISTS "Authenticated users view cutout tasks" ON public.cutout_tasks;
CREATE POLICY "Authenticated users view cutout tasks"
  ON public.cutout_tasks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users view cutout task items" ON public.cutout_task_items;
CREATE POLICY "Authenticated users view cutout task items"
  ON public.cutout_task_items FOR SELECT
  TO authenticated USING (true);

-- base_prices
DROP POLICY IF EXISTS "Anyone can read base_prices" ON public.base_prices;

-- category_factors
DROP POLICY IF EXISTS "Anyone can read category_factors" ON public.category_factors;

-- print_settings (restrict to authenticated)
DROP POLICY IF EXISTS "Allow read access to print_settings" ON public.print_settings;
CREATE POLICY "Authenticated users read print_settings"
  ON public.print_settings FOR SELECT
  TO authenticated USING (true);

-- printed_invoices: drop the broad public SELECT, keep authenticated-only reads
DROP POLICY IF EXISTS "Allow authenticated users to view printed invoices" ON public.printed_invoices;

-- system_settings: restrict default SELECT to authenticated
DROP POLICY IF EXISTS "Public settings read" ON public.system_settings;
CREATE POLICY "Authenticated settings read"
  ON public.system_settings FOR SELECT
  TO authenticated USING (true);

-- Revoke anon SELECT from these tables (defense in depth)
REVOKE SELECT ON public.billboard_extensions FROM anon;
REVOKE SELECT ON public.cutout_tasks FROM anon;
REVOKE SELECT ON public.cutout_task_items FROM anon;
REVOKE SELECT ON public.base_prices FROM anon;
REVOKE SELECT ON public.category_factors FROM anon;
REVOKE SELECT ON public.print_settings FROM anon;
REVOKE SELECT ON public.printed_invoices FROM anon;
REVOKE SELECT ON public.system_settings FROM anon;

-- 2) Prevent privilege escalation via profiles self-update
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins" ON public.profiles;

-- Regular users can update their own row but not privileged fields
CREATE POLICY "Users can update own non-privileged profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = profiles.id)
    AND approved IS NOT DISTINCT FROM (SELECT p.approved FROM public.profiles p WHERE p.id = profiles.id)
    AND status IS NOT DISTINCT FROM (SELECT p.status FROM public.profiles p WHERE p.id = profiles.id)
    AND allowed_customers IS NOT DISTINCT FROM (SELECT p.allowed_customers FROM public.profiles p WHERE p.id = profiles.id)
  );

-- Admins can update any profile including privileged fields
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (has_role((SELECT auth.uid()), 'admin'::app_role))
  WITH CHECK (has_role((SELECT auth.uid()), 'admin'::app_role));
