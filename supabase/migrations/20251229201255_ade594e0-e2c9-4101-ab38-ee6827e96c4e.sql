-- إضافة حقول تخطيط الهيدر والتحكم الدقيق في معلومات الشركة
ALTER TABLE print_settings
ADD COLUMN IF NOT EXISTS header_direction text DEFAULT 'row',
ADD COLUMN IF NOT EXISTS logo_position_order integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS show_company_name boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_company_address boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_company_contact boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS show_company_subtitle boolean DEFAULT false;