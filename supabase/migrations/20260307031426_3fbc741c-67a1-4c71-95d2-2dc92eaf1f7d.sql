ALTER TABLE public.messaging_settings 
ADD COLUMN IF NOT EXISTS whatsapp_provider text NOT NULL DEFAULT 'wppconnect',
ADD COLUMN IF NOT EXISTS wppconnect_bridge_url text;