ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS cover_logo_top text DEFAULT '',
ADD COLUMN IF NOT EXISTS cover_logo_left text DEFAULT '50%',
ADD COLUMN IF NOT EXISTS cover_logo_align text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS cover_phrase_top text DEFAULT '',
ADD COLUMN IF NOT EXISTS cover_phrase_left text DEFAULT '50%',
ADD COLUMN IF NOT EXISTS cover_phrase_align text DEFAULT 'center',
ADD COLUMN IF NOT EXISTS cover_municipality_top text DEFAULT '',
ADD COLUMN IF NOT EXISTS cover_municipality_left text DEFAULT '50%',
ADD COLUMN IF NOT EXISTS cover_municipality_align text DEFAULT 'center';