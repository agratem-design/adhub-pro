-- Add base_rent column to store the original rental price before any deductions
ALTER TABLE public."Contract" 
ADD COLUMN IF NOT EXISTS base_rent numeric DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public."Contract".base_rent IS 'الإيجار الأساسي قبل أي خصومات أو تعديلات';