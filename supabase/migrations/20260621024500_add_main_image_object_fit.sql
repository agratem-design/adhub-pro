ALTER TABLE public.billboard_print_customization ADD COLUMN IF NOT EXISTS main_image_object_fit text DEFAULT 'cover';
