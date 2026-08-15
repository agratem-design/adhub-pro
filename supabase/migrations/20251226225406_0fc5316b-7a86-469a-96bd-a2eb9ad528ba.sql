-- Update setting_key to support multiple modes
-- Each mode will have its own settings record

-- Insert additional mode records if they don't exist
INSERT INTO public.billboard_print_settings (setting_key, background_url, background_width, background_height, elements, primary_font, secondary_font)
SELECT 'with_cutout', background_url, background_width, background_height, elements, primary_font, secondary_font
FROM public.billboard_print_settings WHERE setting_key = 'default'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.billboard_print_settings (setting_key, background_url, background_width, background_height, elements, primary_font, secondary_font)
SELECT 'without_cutout', background_url, background_width, background_height, elements, primary_font, secondary_font
FROM public.billboard_print_settings WHERE setting_key = 'default'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.billboard_print_settings (setting_key, background_url, background_width, background_height, elements, primary_font, secondary_font)
SELECT 'with_design', background_url, background_width, background_height, elements, primary_font, secondary_font
FROM public.billboard_print_settings WHERE setting_key = 'default'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.billboard_print_settings (setting_key, background_url, background_width, background_height, elements, primary_font, secondary_font)
SELECT 'without_design', background_url, background_width, background_height, elements, primary_font, secondary_font
FROM public.billboard_print_settings WHERE setting_key = 'default'
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO public.billboard_print_settings (setting_key, background_url, background_width, background_height, elements, primary_font, secondary_font)
SELECT 'two_faces', background_url, background_width, background_height, elements, primary_font, secondary_font
FROM public.billboard_print_settings WHERE setting_key = 'default'
ON CONFLICT (setting_key) DO NOTHING;

-- Add unique constraint on setting_key if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billboard_print_settings_setting_key_key'
  ) THEN
    ALTER TABLE public.billboard_print_settings ADD CONSTRAINT billboard_print_settings_setting_key_key UNIQUE (setting_key);
  END IF;
END $$;