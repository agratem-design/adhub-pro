INSERT INTO public.billboard_print_customization (
  setting_key,
  installed_images_top,
  installed_image_height,
  billboard_name_top,
  size_top,
  faces_count_top,
  updated_at
)
VALUES (
  'default',
  '80mm',
  '85mm',
  '52mm',
  '48mm',
  '67mm',
  now()
)
ON CONFLICT (setting_key)
DO UPDATE SET
  installed_images_top = EXCLUDED.installed_images_top,
  installed_image_height = EXCLUDED.installed_image_height,
  billboard_name_top = EXCLUDED.billboard_name_top,
  size_top = EXCLUDED.size_top,
  faces_count_top = EXCLUDED.faces_count_top,
  updated_at = now();