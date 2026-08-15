-- Create partners table
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions ledger for shared billboards
CREATE TABLE IF NOT EXISTS shared_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id uuid,
  beneficiary text NOT NULL, -- 'our_company' or partner name or 'capital'
  amount numeric(12,2) NOT NULL,
  type text NOT NULL, -- 'rental_income' | 'capital_deduction' | 'payout'
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_transactions_billboard_idx ON shared_transactions (billboard_id);
CREATE INDEX IF NOT EXISTS shared_transactions_beneficiary_idx ON shared_transactions (beneficiary);
