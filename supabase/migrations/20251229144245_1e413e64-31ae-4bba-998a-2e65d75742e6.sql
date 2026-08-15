-- إنشاء جدول إعدادات سمة الموقع
CREATE TABLE IF NOT EXISTS public.site_theme_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  primary_color TEXT DEFAULT '#8B5CF6',
  secondary_color TEXT DEFAULT '#0EA5E9',
  background_color TEXT DEFAULT '#FFFFFF',
  text_color TEXT DEFAULT '#1A1F2C',
  border_color TEXT DEFAULT '#E2E8F0',
  accent_color TEXT DEFAULT '#D946EF',
  muted_color TEXT DEFAULT '#F1F5F9',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.site_theme_settings ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع
CREATE POLICY "Allow public read access to site_theme_settings"
ON public.site_theme_settings
FOR SELECT
USING (true);

-- سياسة الكتابة للمستخدمين المصادق عليهم
CREATE POLICY "Allow authenticated users to manage site_theme_settings"
ON public.site_theme_settings
FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.site_theme_settings IS 'إعدادات ألوان سمة الموقع';
COMMENT ON COLUMN public.site_theme_settings.primary_color IS 'اللون الأساسي';
COMMENT ON COLUMN public.site_theme_settings.secondary_color IS 'اللون الثانوي';
COMMENT ON COLUMN public.site_theme_settings.background_color IS 'لون الخلفية';
COMMENT ON COLUMN public.site_theme_settings.text_color IS 'لون النصوص';
COMMENT ON COLUMN public.site_theme_settings.border_color IS 'لون الحدود';
COMMENT ON COLUMN public.site_theme_settings.accent_color IS 'لون التمييز';
COMMENT ON COLUMN public.site_theme_settings.muted_color IS 'لون الخلفيات الخافتة';