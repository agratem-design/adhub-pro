-- إنشاء جدول إعدادات الطباعة الموحد
CREATE TABLE IF NOT EXISTS public.print_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type TEXT NOT NULL UNIQUE,
  
  -- معلومات الشركة
  company_name TEXT DEFAULT '',
  company_subtitle TEXT DEFAULT '',
  company_address TEXT DEFAULT '',
  company_phone TEXT DEFAULT '',
  
  -- الاتجاه والمحاذاة
  direction TEXT DEFAULT 'rtl' CHECK (direction IN ('rtl', 'ltr')),
  header_alignment TEXT DEFAULT 'right' CHECK (header_alignment IN ('right', 'center', 'left')),
  footer_alignment TEXT DEFAULT 'center' CHECK (footer_alignment IN ('right', 'center', 'left')),
  
  -- الألوان
  primary_color TEXT DEFAULT '#D4AF37',
  secondary_color TEXT DEFAULT '#1a1a2e',
  accent_color TEXT DEFAULT '#f0e6d2',
  header_bg_color TEXT DEFAULT '#D4AF37',
  header_text_color TEXT DEFAULT '#ffffff',
  
  -- الخطوط
  font_family TEXT DEFAULT 'Doran',
  title_font_size INTEGER DEFAULT 24,
  header_font_size INTEGER DEFAULT 14,
  body_font_size INTEGER DEFAULT 12,
  
  -- الشعار
  show_logo BOOLEAN DEFAULT true,
  logo_path TEXT DEFAULT '/logofaresgold.svg',
  logo_size INTEGER DEFAULT 60,
  logo_position TEXT DEFAULT 'right' CHECK (logo_position IN ('right', 'center', 'left')),
  
  -- الفوتر
  show_footer BOOLEAN DEFAULT true,
  footer_text TEXT DEFAULT 'شكراً لتعاملكم معنا',
  show_page_number BOOLEAN DEFAULT true,
  
  -- الخلفية
  background_image TEXT DEFAULT '',
  background_opacity INTEGER DEFAULT 100,
  
  -- المسافات
  page_margin_top INTEGER DEFAULT 15,
  page_margin_bottom INTEGER DEFAULT 15,
  page_margin_left INTEGER DEFAULT 15,
  page_margin_right INTEGER DEFAULT 15,
  
  -- metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إنشاء trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION public.update_print_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_print_settings_timestamp
  BEFORE UPDATE ON public.print_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_print_settings_updated_at();

-- إضافة RLS
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع (الإعدادات عامة)
CREATE POLICY "Allow read access to print_settings"
  ON public.print_settings
  FOR SELECT
  USING (true);

-- سياسة الكتابة للمسؤولين فقط
CREATE POLICY "Allow admin write access to print_settings"
  ON public.print_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- إنشاء index على document_type
CREATE INDEX IF NOT EXISTS idx_print_settings_document_type 
  ON public.print_settings(document_type);

-- إدراج الإعدادات الافتراضية لجميع أنواع المستندات
INSERT INTO public.print_settings (document_type) VALUES
  ('contract_invoice'),
  ('quotation'),
  ('payment_receipt'),
  ('team_payment_receipt'),
  ('friend_rent_receipt'),
  ('sales_invoice'),
  ('purchase_invoice'),
  ('expense_invoice'),
  ('print_service_invoice'),
  ('installation_invoice'),
  ('print_task'),
  ('cut_task'),
  ('combined_task'),
  ('customer_invoice'),
  ('measurements_invoice'),
  ('account_statement'),
  ('custody_statement'),
  ('late_notice')
ON CONFLICT (document_type) DO NOTHING;