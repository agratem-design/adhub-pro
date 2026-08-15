ALTER TABLE public.print_settings 
ADD COLUMN IF NOT EXISTS table_line_height text DEFAULT '1.4',
ADD COLUMN IF NOT EXISTS table_border_width numeric DEFAULT 1,
ADD COLUMN IF NOT EXISTS table_border_style text DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS table_header_height numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS table_body_row_height numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS totals_box_bg_color text DEFAULT '#f8f9fa',
ADD COLUMN IF NOT EXISTS totals_box_text_color text DEFAULT '#333333',
ADD COLUMN IF NOT EXISTS totals_box_border_color text DEFAULT '#D4AF37',
ADD COLUMN IF NOT EXISTS totals_box_border_radius numeric DEFAULT 8,
ADD COLUMN IF NOT EXISTS totals_title_font_size numeric DEFAULT 14,
ADD COLUMN IF NOT EXISTS totals_value_font_size numeric DEFAULT 16;