-- Add missing columns for map settings
ALTER TABLE public.billboard_print_customization 
ADD COLUMN IF NOT EXISTS map_zoom text DEFAULT '15',
ADD COLUMN IF NOT EXISTS map_show_labels text DEFAULT 'hybrid';