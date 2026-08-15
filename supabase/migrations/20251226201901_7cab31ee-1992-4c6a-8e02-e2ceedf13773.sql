-- Add columns for including operating fee in print and installation
ALTER TABLE public."Contract"
ADD COLUMN IF NOT EXISTS include_operating_in_print boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS include_operating_in_installation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS level_discounts jsonb DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public."Contract".include_operating_in_print IS 'Include operating fee rate in print cost calculation';
COMMENT ON COLUMN public."Contract".include_operating_in_installation IS 'Include operating fee rate in installation cost calculation';
COMMENT ON COLUMN public."Contract".level_discounts IS 'JSON object storing discount per billboard level';