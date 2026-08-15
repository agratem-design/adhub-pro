-- Create template_settings table for PDF template customization
CREATE TABLE IF NOT EXISTS public.template_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'contract', 'billboard_print', 'invoice', etc.
  
  -- Colors
  primary_color TEXT DEFAULT '#d4af37',
  secondary_color TEXT DEFAULT '#1e293b',
  text_color TEXT DEFAULT '#f1f5f9',
  background_color TEXT DEFAULT '#0f172a',
  
  -- Fonts
  header_font TEXT DEFAULT 'Cairo',
  body_font TEXT DEFAULT 'Cairo',
  font_size_header INTEGER DEFAULT 24,
  font_size_body INTEGER DEFAULT 14,
  
  -- Margins (in pixels)
  margin_top INTEGER DEFAULT 40,
  margin_right INTEGER DEFAULT 40,
  margin_bottom INTEGER DEFAULT 40,
  margin_left INTEGER DEFAULT 40,
  
  -- Logo
  logo_url TEXT,
  logo_width INTEGER DEFAULT 150,
  logo_height INTEGER DEFAULT 80,
  show_logo BOOLEAN DEFAULT true,
  
  -- Header & Footer
  header_text TEXT,
  footer_text TEXT,
  show_header BOOLEAN DEFAULT true,
  show_footer BOOLEAN DEFAULT true,
  
  -- Signature
  signature_url TEXT,
  signature_label TEXT DEFAULT 'التوقيع',
  show_signature BOOLEAN DEFAULT true,
  
  -- Additional settings
  page_orientation TEXT DEFAULT 'portrait', -- 'portrait' or 'landscape'
  page_size TEXT DEFAULT 'a4', -- 'a4', 'letter', etc.
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_template_settings_type ON public.template_settings(template_type);
CREATE INDEX idx_template_settings_default ON public.template_settings(is_default, template_type);

-- Enable RLS
ALTER TABLE public.template_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on template_settings"
  ON public.template_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert default template for contracts
INSERT INTO public.template_settings (
  template_name,
  template_type,
  is_default
) VALUES (
  'قالب العقود الافتراضي',
  'contract',
  true
);

-- Insert default template for billboard prints
INSERT INTO public.template_settings (
  template_name,
  template_type,
  is_default
) VALUES (
  'قالب طباعة اللوحات الافتراضي',
  'billboard_print',
  true
);