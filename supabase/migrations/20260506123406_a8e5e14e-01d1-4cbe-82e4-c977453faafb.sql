ALTER TABLE public.custody_expenses 
ADD COLUMN IF NOT EXISTS receipt_image_url text,
ADD COLUMN IF NOT EXISTS receipt_image_path text;