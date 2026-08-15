
-- Fix: Restrict public access to sensitive API keys in system_settings
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can access system settings" ON public.system_settings;

-- Allow public read access to non-sensitive settings only
CREATE POLICY "Public settings read"
ON public.system_settings
FOR SELECT
USING (
  setting_key NOT IN ('imgbb_api_key', 'freeimage_api_key', 'cloudinary_api_key', 'postimg_api_key', 'cloudinary_cloud_name', 'cloudinary_api_secret')
  OR public.has_role(auth.uid(), 'admin')
);

-- Allow admins full management access
CREATE POLICY "Admins manage settings"
ON public.system_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
