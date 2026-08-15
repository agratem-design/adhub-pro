
ALTER TABLE public.billboard_print_customization
  ADD COLUMN IF NOT EXISTS status_badges_top text DEFAULT '75mm',
  ADD COLUMN IF NOT EXISTS status_badges_left text DEFAULT '50%',
  ADD COLUMN IF NOT EXISTS status_badges_font_size text DEFAULT '11px',
  ADD COLUMN IF NOT EXISTS status_badges_show text DEFAULT 'true';
