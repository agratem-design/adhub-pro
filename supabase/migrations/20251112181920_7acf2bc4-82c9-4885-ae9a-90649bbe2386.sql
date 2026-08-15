-- Add design_face_b_url column to task_designs table
ALTER TABLE public.task_designs 
ADD COLUMN IF NOT EXISTS design_face_b_url TEXT;

-- Rename design_url to design_face_a_url for clarity
ALTER TABLE public.task_designs 
RENAME COLUMN design_url TO design_face_a_url;

-- Add comment for clarity
COMMENT ON COLUMN public.task_designs.design_face_a_url IS 'URL for front face (A) design';
COMMENT ON COLUMN public.task_designs.design_face_b_url IS 'URL for back face (B) design';