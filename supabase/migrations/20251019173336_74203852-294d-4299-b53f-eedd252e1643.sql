-- Fix messaging_settings RLS policies to allow service role access
-- This is needed for edge functions to read/write settings

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins can update messaging settings" ON messaging_settings;
DROP POLICY IF EXISTS "Admins can view messaging settings" ON messaging_settings;

-- Create new policies that work with both authenticated users and service role
CREATE POLICY "Service role full access to messaging_settings"
  ON messaging_settings
  FOR ALL
  USING (
    -- Allow service role (for edge functions)
    current_setting('role') = 'service_role'
    OR
    -- Allow admin users
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    current_setting('role') = 'service_role'
    OR
    has_role(auth.uid(), 'admin'::app_role)
  );

-- Ensure the settings row exists with correct ID
INSERT INTO messaging_settings (id, whatsapp_bridge_url)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;