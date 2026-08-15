
UPDATE public.billboard_print_customization 
SET 
  installed_images_top = '80mm',
  installed_image_height = '85mm',
  billboard_name_top = '52mm',
  size_top = '48mm',
  faces_count_top = '67mm',
  updated_at = now()
WHERE installed_images_top = '88mm' OR billboard_name_top = '47mm' OR size_top = '43mm';
