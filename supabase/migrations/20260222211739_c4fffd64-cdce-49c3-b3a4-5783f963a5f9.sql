-- Add separate operating fee rates for installation and print
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS operating_fee_rate_installation numeric DEFAULT 3;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS operating_fee_rate_print numeric DEFAULT 3;

-- Set defaults for existing contracts
UPDATE "Contract" SET operating_fee_rate_installation = COALESCE(operating_fee_rate, 3) WHERE operating_fee_rate_installation IS NULL;
UPDATE "Contract" SET operating_fee_rate_print = COALESCE(operating_fee_rate, 3) WHERE operating_fee_rate_print IS NULL;