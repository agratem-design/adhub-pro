-- Fix RLS policy for messaging_settings to allow authenticated admin users
-- The previous policy only worked with service_role, but we need it to work from the browser too

DROP POLICY IF EXISTS "Service role full access to messaging_settings" ON messaging_settings;

-- Create new policy that allows authenticated admin users
CREATE POLICY "Admins can manage messaging settings"
  ON messaging_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also ensure the default row exists
INSERT INTO messaging_settings (id, whatsapp_bridge_url)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;