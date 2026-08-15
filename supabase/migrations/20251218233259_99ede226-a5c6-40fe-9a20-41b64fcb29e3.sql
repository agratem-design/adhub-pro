-- Add partnership_share column to track each partner's share from each contract
ALTER TABLE shared_billboards 
ADD COLUMN IF NOT EXISTS contract_id bigint REFERENCES "Contract"("Contract_Number") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS contract_share numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS company_share numeric(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS capital_deduction_per_contract numeric(12,2) DEFAULT 0;

-- Add partnership operating fee rate to Contract table (already exists, just ensure it)
-- partnership_operating_fee_rate already exists

-- Create table to track partnership transactions per contract
CREATE TABLE IF NOT EXISTS partnership_contract_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id bigint NOT NULL REFERENCES "Contract"("Contract_Number") ON DELETE CASCADE,
  billboard_id bigint NOT NULL,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_name text,
  rent_amount numeric(12,2) DEFAULT 0,
  partner_share_amount numeric(12,2) DEFAULT 0,
  partner_share_percentage numeric(5,2) DEFAULT 0,
  company_share_amount numeric(12,2) DEFAULT 0,
  company_share_percentage numeric(5,2) DEFAULT 0,
  capital_deduction numeric(12,2) DEFAULT 0,
  capital_remaining_after numeric(12,2) DEFAULT 0,
  phase text DEFAULT 'recovery', -- 'recovery' or 'profit_sharing'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_partnership_contract_shares_contract 
ON partnership_contract_shares(contract_id);

CREATE INDEX IF NOT EXISTS idx_partnership_contract_shares_partner 
ON partnership_contract_shares(partner_id);

CREATE INDEX IF NOT EXISTS idx_partnership_contract_shares_billboard 
ON partnership_contract_shares(billboard_id);

-- Create function to handle billboard removal from contract
CREATE OR REPLACE FUNCTION handle_billboard_removal_from_contract()
RETURNS TRIGGER AS $$
DECLARE
  old_billboard_ids text[];
  new_billboard_ids text[];
  removed_id text;
  billboard_capital_remaining numeric;
  deduction_to_reverse numeric;
BEGIN
  -- Parse old and new billboard_ids
  IF OLD.billboard_ids IS NOT NULL THEN
    old_billboard_ids := string_to_array(OLD.billboard_ids, ',');
  ELSE
    old_billboard_ids := ARRAY[]::text[];
  END IF;
  
  IF NEW.billboard_ids IS NOT NULL THEN
    new_billboard_ids := string_to_array(NEW.billboard_ids, ',');
  ELSE
    new_billboard_ids := ARRAY[]::text[];
  END IF;
  
  -- Find removed billboards
  FOREACH removed_id IN ARRAY old_billboard_ids
  LOOP
    removed_id := trim(removed_id);
    IF removed_id != '' AND NOT removed_id = ANY(new_billboard_ids) THEN
      -- Get the deduction amount that was applied
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = removed_id::bigint;
      
      -- Reverse the capital deduction on the billboard
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards
        SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = removed_id::integer;
      END IF;
      
      -- Delete the partnership contract shares for this billboard
      DELETE FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = removed_id::bigint;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contract updates
DROP TRIGGER IF EXISTS trg_handle_billboard_removal ON "Contract";
CREATE TRIGGER trg_handle_billboard_removal
BEFORE UPDATE ON "Contract"
FOR EACH ROW
WHEN (OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids)
EXECUTE FUNCTION handle_billboard_removal_from_contract();

-- Create function to handle contract deletion
CREATE OR REPLACE FUNCTION handle_contract_deletion()
RETURNS TRIGGER AS $$
DECLARE
  billboard_id_str text;
  billboard_ids_arr text[];
  deduction_to_reverse numeric;
BEGIN
  -- Parse billboard_ids
  IF OLD.billboard_ids IS NOT NULL THEN
    billboard_ids_arr := string_to_array(OLD.billboard_ids, ',');
  ELSE
    billboard_ids_arr := ARRAY[]::text[];
  END IF;
  
  -- Reverse capital deductions for all partnership billboards
  FOREACH billboard_id_str IN ARRAY billboard_ids_arr
  LOOP
    billboard_id_str := trim(billboard_id_str);
    IF billboard_id_str != '' THEN
      -- Get the deduction amount
      SELECT COALESCE(SUM(capital_deduction), 0) INTO deduction_to_reverse
      FROM partnership_contract_shares
      WHERE contract_id = OLD."Contract_Number" 
        AND billboard_id = billboard_id_str::bigint;
      
      -- Reverse the capital deduction
      IF deduction_to_reverse > 0 THEN
        UPDATE billboards
        SET capital_remaining = COALESCE(capital_remaining, capital) + deduction_to_reverse
        WHERE "ID" = billboard_id_str::integer;
      END IF;
    END IF;
  END LOOP;
  
  -- partnership_contract_shares will be deleted automatically due to ON DELETE CASCADE
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contract deletion
DROP TRIGGER IF EXISTS trg_handle_contract_deletion ON "Contract";
CREATE TRIGGER trg_handle_contract_deletion
BEFORE DELETE ON "Contract"
FOR EACH ROW
EXECUTE FUNCTION handle_contract_deletion();