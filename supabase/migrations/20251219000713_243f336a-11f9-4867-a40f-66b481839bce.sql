-- Add column to store partnership operating fee details per billboard
ALTER TABLE public."Contract" 
ADD COLUMN IF NOT EXISTS partnership_operating_data jsonb DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public."Contract".partnership_operating_data IS 'Stores detailed operating fee breakdown for each partnership billboard in the contract';