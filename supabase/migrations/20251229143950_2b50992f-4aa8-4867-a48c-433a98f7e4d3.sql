-- إضافة حقول الألوان الناقصة للنصوص
ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS contract_number_color TEXT DEFAULT '#333',
ADD COLUMN IF NOT EXISTS team_name_color TEXT DEFAULT '#333',
ADD COLUMN IF NOT EXISTS installation_date_color TEXT DEFAULT '#333',
ADD COLUMN IF NOT EXISTS location_info_color TEXT DEFAULT '#333',
ADD COLUMN IF NOT EXISTS landmark_info_color TEXT DEFAULT '#333';

-- إضافة حقول التحكم الإضافية لتاريخ التركيب
ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS installation_date_font_weight TEXT DEFAULT 'normal';

COMMENT ON COLUMN public.billboard_print_customization.contract_number_color IS 'لون نص رقم العقد';
COMMENT ON COLUMN public.billboard_print_customization.team_name_color IS 'لون نص فريق التركيب';
COMMENT ON COLUMN public.billboard_print_customization.installation_date_color IS 'لون نص تاريخ التركيب';
COMMENT ON COLUMN public.billboard_print_customization.installation_date_font_weight IS 'وزن خط تاريخ التركيب';
COMMENT ON COLUMN public.billboard_print_customization.location_info_color IS 'لون نص الموقع';
COMMENT ON COLUMN public.billboard_print_customization.landmark_info_color IS 'لون نص المعلم';