-- Add columns to customers table to track customer/supplier type
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS is_customer boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_supplier boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS supplier_type text DEFAULT NULL;

-- Add comment to explain supplier_type values
COMMENT ON COLUMN customers.supplier_type IS 'Type of supplier: general_purchases, billboard_rental, or NULL if not a supplier';

-- Update existing customers to be customers by default
UPDATE customers 
SET is_customer = true, is_supplier = false 
WHERE is_customer IS NULL;