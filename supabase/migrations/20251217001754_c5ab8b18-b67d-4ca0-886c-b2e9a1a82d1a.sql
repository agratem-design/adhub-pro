-- Add missing columns to customer_payments if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'source_bank') THEN
    ALTER TABLE customer_payments ADD COLUMN source_bank text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'destination_bank') THEN
    ALTER TABLE customer_payments ADD COLUMN destination_bank text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_payments' AND column_name = 'transfer_reference') THEN
    ALTER TABLE customer_payments ADD COLUMN transfer_reference text;
  END IF;
END $$;