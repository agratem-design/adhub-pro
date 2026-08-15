
-- Add invoice-style columns to contract_expenses
ALTER TABLE public.contract_expenses 
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0 NOT NULL;

-- Update amount to be computed (quantity * unit_price), but keep it as stored value
-- We'll handle the calculation in the app layer
-- Add a note column for extra context
ALTER TABLE public.contract_expenses
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill existing rows: set unit_price = amount and quantity = 1
UPDATE public.contract_expenses
SET quantity = 1, unit_price = amount
WHERE quantity = 0 OR unit_price = 0;
