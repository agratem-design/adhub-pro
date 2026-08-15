ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS pin_size text DEFAULT '80';