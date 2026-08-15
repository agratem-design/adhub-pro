-- إضافة حقول جديدة لتخصيص النصوص (المحاذاة والإزاحة الأفقية)
ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS billboard_name_alignment text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS billboard_name_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS size_alignment text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS size_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS faces_count_alignment text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS faces_count_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS contract_number_alignment text DEFAULT 'right',
ADD COLUMN IF NOT EXISTS contract_number_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS installation_date_alignment text DEFAULT 'right',
ADD COLUMN IF NOT EXISTS installation_date_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS team_name_alignment text DEFAULT 'right',
ADD COLUMN IF NOT EXISTS team_name_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS location_info_alignment text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS location_info_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS landmark_info_alignment text DEFAULT 'left',
ADD COLUMN IF NOT EXISTS landmark_info_offset_x text DEFAULT '0mm',
ADD COLUMN IF NOT EXISTS preview_zoom text DEFAULT '35%',
ADD COLUMN IF NOT EXISTS preview_background text DEFAULT '#ffffff';

-- تحديث السجل الافتراضي بالقيم الجديدة
UPDATE public.billboard_print_customization 
SET 
  billboard_name_alignment = 'center',
  billboard_name_offset_x = '0mm',
  size_alignment = 'center',
  size_offset_x = '0mm',
  faces_count_alignment = 'center',
  faces_count_offset_x = '0mm',
  contract_number_alignment = 'right',
  contract_number_offset_x = '0mm',
  installation_date_alignment = 'right',
  installation_date_offset_x = '0mm',
  team_name_alignment = 'right',
  team_name_offset_x = '0mm',
  location_info_alignment = 'left',
  location_info_offset_x = '0mm',
  landmark_info_alignment = 'left',
  landmark_info_offset_x = '0mm',
  preview_zoom = '35%',
  preview_background = '#ffffff'
WHERE setting_key = 'default';