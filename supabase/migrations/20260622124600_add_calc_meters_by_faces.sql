ALTER TABLE public.billboard_print_customization ADD COLUMN IF NOT EXISTS calc_meters_by_faces text DEFAULT 'false';
