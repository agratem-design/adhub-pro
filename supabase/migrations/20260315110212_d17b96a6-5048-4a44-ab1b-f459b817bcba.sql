
-- Add fallback_path columns to image-bearing tables

-- installation_task_items
ALTER TABLE public.installation_task_items 
  ADD COLUMN IF NOT EXISTS fallback_path_design_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_design_b text,
  ADD COLUMN IF NOT EXISTS fallback_path_installed_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_installed_b text;

-- task_designs
ALTER TABLE public.task_designs 
  ADD COLUMN IF NOT EXISTS fallback_path_face_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_face_b text,
  ADD COLUMN IF NOT EXISTS fallback_path_cutout text;

-- installation_photo_history
ALTER TABLE public.installation_photo_history 
  ADD COLUMN IF NOT EXISTS fallback_path_installed_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_installed_b text;

-- billboards
ALTER TABLE public.billboards 
  ADD COLUMN IF NOT EXISTS fallback_path_image text;

-- billboard_history
ALTER TABLE public.billboard_history 
  ADD COLUMN IF NOT EXISTS fallback_path_design_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_design_b text,
  ADD COLUMN IF NOT EXISTS fallback_path_installed_a text,
  ADD COLUMN IF NOT EXISTS fallback_path_installed_b text;
