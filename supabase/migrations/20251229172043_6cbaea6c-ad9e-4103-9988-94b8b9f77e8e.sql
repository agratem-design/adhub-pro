-- Fix RLS for print_settings to match the app's admin role system

-- Drop legacy policy that depends on public.users.role
DROP POLICY IF EXISTS "Allow admin write access to print_settings" ON public.print_settings;

-- Ensure RLS is enabled
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;

-- Keep read policy (already exists in many cases)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='print_settings' AND policyname='Allow read access to print_settings'
  ) THEN
    CREATE POLICY "Allow read access to print_settings"
    ON public.print_settings
    FOR SELECT
    USING (true);
  END IF;
END $$;

-- Create admin manage policy using user_roles/app_role (consistent with other tables)
CREATE POLICY "Admins manage print_settings"
ON public.print_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'::app_role
  )
);
