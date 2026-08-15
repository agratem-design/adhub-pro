-- Add friend rental operating fee columns to Contract table
ALTER TABLE public."Contract" 
ADD COLUMN IF NOT EXISTS friend_rental_operating_fee_rate numeric DEFAULT 3,
ADD COLUMN IF NOT EXISTS friend_rental_operating_fee_enabled boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public."Contract".friend_rental_operating_fee_rate IS 'Operating fee percentage for friend company billboards (default 3%)';
COMMENT ON COLUMN public."Contract".friend_rental_operating_fee_enabled IS 'Whether to apply operating fee on friend company billboard costs';