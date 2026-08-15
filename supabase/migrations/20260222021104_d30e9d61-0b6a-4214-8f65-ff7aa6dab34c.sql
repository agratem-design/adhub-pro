ALTER TABLE public.billboard_print_customization
  ADD COLUMN IF NOT EXISTS coords_font_size text DEFAULT '11px',
  ADD COLUMN IF NOT EXISTS coords_font_family text DEFAULT 'Manrope',
  ADD COLUMN IF NOT EXISTS coords_bar_height text DEFAULT '26px';