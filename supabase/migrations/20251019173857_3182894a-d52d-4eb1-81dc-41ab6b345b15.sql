-- Open up messaging_settings for the UI (temporary, scoped to fixed row)
-- 1) Ensure RLS is enabled
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;

-- 2) Replace existing strict policy
DROP POLICY IF EXISTS "Admins can manage messaging settings" ON public.messaging_settings;
DROP POLICY IF EXISTS "Service role full access to messaging_settings" ON public.messaging_settings;

-- 3) Allow public read
CREATE POLICY "Public can read messaging settings"
  ON public.messaging_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4) Allow upsert of the single settings row from browser (anon/auth)
CREATE POLICY "UI can insert settings row"
  ON public.messaging_settings
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "UI can update settings row"
  ON public.messaging_settings
  FOR UPDATE
  TO anon, authenticated
  USING (id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001');

-- 5) Seed the fixed row if missing
INSERT INTO public.messaging_settings (id, whatsapp_bridge_url)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;