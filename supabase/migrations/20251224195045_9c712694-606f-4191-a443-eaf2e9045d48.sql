-- Add custody_name column for custom naming
ALTER TABLE public.custody_accounts 
ADD COLUMN IF NOT EXISTS custody_name TEXT;