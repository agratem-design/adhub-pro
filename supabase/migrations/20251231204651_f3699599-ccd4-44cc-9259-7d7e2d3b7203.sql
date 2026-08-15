-- Add column for first payment at signing option
ALTER TABLE public."Contract" 
ADD COLUMN IF NOT EXISTS installment_first_at_signing boolean DEFAULT true;