-- Create table for municipality stickers settings
CREATE TABLE public.municipality_stickers_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  setting_name TEXT NOT NULL DEFAULT 'default',
  phone_number TEXT,
  use_unified_size BOOLEAN DEFAULT false,
  unified_size_width NUMERIC DEFAULT 30,
  unified_size_height NUMERIC DEFAULT 30,
  reserve_count INTEGER DEFAULT 0,
  max_number INTEGER,
  element_positions JSONB DEFAULT '{"logoHeight": 20, "numberSize": 28, "qrSize": 22, "phoneSize": 6, "infoSize": 4, "topSectionHeight": 22, "bottomSectionHeight": 28}',
  element_visibility JSONB DEFAULT '{"companyLogo": true, "municipalityLogo": true, "billboardNumber": true, "billboardName": true, "billboardSize": true, "billboardId": true, "phoneNumber": true, "whatsappQr": true, "gpsQr": true, "reserveLabel": true}',
  color_settings JSONB DEFAULT '{"borderColor": "#000000", "numberColor": "#000000", "textColor": "#374151", "phoneColor": "#000000", "qrLabelColor": "#4B5563", "dividerColor": "#000000"}',
  font_settings JSONB DEFAULT '{"main": "Doran", "number": "Doran", "info": "Doran", "phone": "Doran"}',
  size_configs JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, setting_name)
);

-- Enable RLS
ALTER TABLE public.municipality_stickers_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this app doesn't use auth)
CREATE POLICY "Allow all operations on municipality_stickers_settings" 
ON public.municipality_stickers_settings 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_municipality_stickers_settings_updated_at
BEFORE UPDATE ON public.municipality_stickers_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();