-- Create messaging_api_settings table
CREATE TABLE IF NOT EXISTS public.messaging_api_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('whatsapp', 'telegram')),
  api_key TEXT,
  api_secret TEXT,
  phone_number TEXT,
  bot_token TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(platform)
);

-- Enable RLS
ALTER TABLE public.messaging_api_settings ENABLE ROW LEVEL SECURITY;

-- Admin can manage settings
CREATE POLICY "Admins manage messaging settings"
  ON public.messaging_api_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_messaging_api_settings_updated_at
  BEFORE UPDATE ON public.messaging_api_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();