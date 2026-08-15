-- Add missing columns to offers table to match contract functionality
ALTER TABLE offers ADD COLUMN IF NOT EXISTS installation_cost numeric DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS installation_enabled boolean DEFAULT true;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS print_cost numeric DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS print_cost_enabled boolean DEFAULT false;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS print_price_per_meter numeric DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS installments_data jsonb DEFAULT '[]'::jsonb;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS billboard_prices jsonb DEFAULT '[]'::jsonb;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS operating_fee numeric DEFAULT 0;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS operating_fee_rate numeric DEFAULT 3;