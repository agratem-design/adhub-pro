-- Add column for storing include_installation_in_price
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS include_installation_in_price boolean DEFAULT true;