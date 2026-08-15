
-- إضافة أعمدة تخصيص الجداول
ALTER TABLE public.print_settings
  ADD COLUMN IF NOT EXISTS table_header_font_size integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS table_header_padding text DEFAULT '4px 8px',
  ADD COLUMN IF NOT EXISTS table_body_font_size integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS table_body_padding text DEFAULT '4px',
  ADD COLUMN IF NOT EXISTS table_header_font_weight text DEFAULT 'bold';
