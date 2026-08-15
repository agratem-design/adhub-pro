ALTER TABLE public.billboard_print_customization
  ADD COLUMN IF NOT EXISTS billboard_status_enabled text NOT NULL DEFAULT 'true',
  ADD COLUMN IF NOT EXISTS billboard_status_font_size text NOT NULL DEFAULT '14px',
  ADD COLUMN IF NOT EXISTS billboard_status_offset_y text NOT NULL DEFAULT '6mm';