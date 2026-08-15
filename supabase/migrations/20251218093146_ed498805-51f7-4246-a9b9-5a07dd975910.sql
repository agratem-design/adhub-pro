-- Add column to control billboard visibility in available list
ALTER TABLE public.billboards 
ADD COLUMN IF NOT EXISTS is_visible_in_available boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.billboards.is_visible_in_available IS 'Controls whether billboard appears in available billboards list and exports';