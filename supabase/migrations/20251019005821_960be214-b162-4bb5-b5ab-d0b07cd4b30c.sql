-- Create messaging_settings table to store WhatsApp bridge URL
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp_bridge_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to read and update settings
CREATE POLICY "Admins can view messaging settings"
  ON public.messaging_settings
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update messaging settings"
  ON public.messaging_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default row
INSERT INTO public.messaging_settings (id, whatsapp_bridge_url)
VALUES ('00000000-0000-0000-0000-000000000001', NULL)
ON CONFLICT DO NOTHING;