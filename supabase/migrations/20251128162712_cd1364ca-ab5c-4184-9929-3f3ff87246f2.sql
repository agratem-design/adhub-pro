-- إنشاء جدول إعدادات النظام
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- إدراج القيم الافتراضية
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
  ('google_sheets_url', 'https://docs.google.com/spreadsheets/d/1fF9BUgBcW9OW3nWT97Uke_z2Pq3y_LC0/edit?gid=1118301152#gid=1118301152', 'رابط ملف Google Sheets للوحات الإعلانية'),
  ('google_maps_url', '', 'رابط خريطة Google Maps')
ON CONFLICT (setting_key) DO NOTHING;

-- تمكين RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- السماح بالقراءة للجميع
CREATE POLICY "السماح بالقراءة للجميع"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- السماح بالتحديث للمستخدمين المسجلين فقط
CREATE POLICY "السماح بالتحديث للمستخدمين المسجلين"
  ON public.system_settings
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- إنشاء trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_system_settings_updated_at();