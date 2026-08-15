-- Add columns for storing include_print_in_billboard_price and detailed costs
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS include_print_in_billboard_price boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS installation_details jsonb,
ADD COLUMN IF NOT EXISTS print_details jsonb;