-- Add new fields for Totals Section styling
ALTER TABLE print_settings 
ADD COLUMN IF NOT EXISTS totals_box_bg_color TEXT DEFAULT '#f8f9fa',
ADD COLUMN IF NOT EXISTS totals_box_text_color TEXT DEFAULT '#333333',
ADD COLUMN IF NOT EXISTS totals_box_border_color TEXT DEFAULT '#D4AF37',
ADD COLUMN IF NOT EXISTS totals_box_border_radius INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS totals_title_font_size INTEGER DEFAULT 14,
ADD COLUMN IF NOT EXISTS totals_value_font_size INTEGER DEFAULT 16;