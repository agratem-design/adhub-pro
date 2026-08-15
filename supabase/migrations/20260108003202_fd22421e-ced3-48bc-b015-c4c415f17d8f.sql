-- Add missing columns to offers table
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS selected_boards jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'fixed',
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS level_discounts jsonb DEFAULT '[]'::jsonb;