-- Create billboard print settings table
CREATE TABLE public.billboard_print_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL DEFAULT 'default',
  
  -- خلفية الصفحة
  background_url TEXT DEFAULT '/ipg.svg',
  background_width VARCHAR(20) DEFAULT '210mm',
  background_height VARCHAR(20) DEFAULT '297mm',
  
  -- إعدادات العناصر (JSON لكل عنصر)
  elements JSONB DEFAULT '{
    "contractNumber": {"visible": true, "top": "39.869mm", "right": "22mm", "fontSize": "16px", "fontWeight": "500", "color": "#000"},
    "billboardName": {"visible": true, "top": "55.588mm", "left": "15.5%", "fontSize": "20px", "fontWeight": "500", "color": "#333", "width": "120mm", "textAlign": "center"},
    "size": {"visible": true, "top": "51mm", "left": "63%", "fontSize": "41px", "fontWeight": "500", "width": "80mm", "textAlign": "center"},
    "facesCount": {"visible": true, "top": "63mm", "left": "64%", "fontSize": "12px", "color": "#000", "width": "80mm", "textAlign": "center"},
    "image": {"visible": true, "top": "90mm", "left": "50%", "width": "120mm", "height": "140mm", "borderWidth": "3px", "borderColor": "#000", "borderRadius": "0 0 0 8px"},
    "locationInfo": {"visible": true, "top": "233mm", "left": "0", "fontSize": "16px", "width": "150mm"},
    "landmarkInfo": {"visible": true, "top": "241mm", "left": "0mm", "fontSize": "16px", "width": "150mm"},
    "qrCode": {"visible": true, "top": "255mm", "left": "65mm", "width": "30mm", "height": "30mm"},
    "designs": {"visible": true, "top": "178mm", "left": "16mm", "width": "178mm", "gap": "10mm"},
    "installationDate": {"visible": true, "top": "42.869mm", "right": "116mm", "fontSize": "11px", "fontWeight": "400"},
    "printType": {"visible": true, "top": "45mm", "right": "22mm", "fontSize": "14px", "color": "#d4af37", "fontWeight": "bold"}
  }'::jsonb,
  
  -- إعدادات الخطوط
  primary_font VARCHAR(100) DEFAULT 'Doran',
  secondary_font VARCHAR(100) DEFAULT 'Manrope',
  
  -- إعدادات CSS إضافية
  custom_css TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.billboard_print_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Billboard print settings readable by authenticated"
ON public.billboard_print_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Only admins can manage billboard print settings"
ON public.billboard_print_settings
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default settings
INSERT INTO public.billboard_print_settings (setting_key) VALUES ('default');

-- Trigger for updated_at
CREATE TRIGGER update_billboard_print_settings_updated_at
BEFORE UPDATE ON public.billboard_print_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();