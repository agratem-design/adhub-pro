-- Add logo_url column to municipalities table
ALTER TABLE public.municipalities 
ADD COLUMN IF NOT EXISTS logo_url TEXT;