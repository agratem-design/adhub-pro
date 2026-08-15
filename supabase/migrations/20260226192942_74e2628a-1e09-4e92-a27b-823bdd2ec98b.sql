
ALTER TABLE public.billboard_print_customization
ADD COLUMN IF NOT EXISTS cover_page_enabled text DEFAULT 'true',
ADD COLUMN IF NOT EXISTS cover_logo_url text DEFAULT '/logofaresgold.svg',
ADD COLUMN IF NOT EXISTS cover_phrase text DEFAULT 'لوحات',
ADD COLUMN IF NOT EXISTS cover_phrase_font_size text DEFAULT '28px',
ADD COLUMN IF NOT EXISTS cover_municipality_font_size text DEFAULT '36px',
ADD COLUMN IF NOT EXISTS cover_logo_size text DEFAULT '200px';
