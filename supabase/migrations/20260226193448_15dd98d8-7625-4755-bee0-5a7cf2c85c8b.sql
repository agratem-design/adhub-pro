ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS cover_background_enabled text DEFAULT 'true';