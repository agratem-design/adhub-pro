-- Create friend_companies table for managing partner companies
CREATE TABLE IF NOT EXISTS friend_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add friend_company_id to billboards table
ALTER TABLE billboards
ADD COLUMN IF NOT EXISTS friend_company_id UUID;

-- Add foreign key after creating the column
ALTER TABLE billboards
ADD CONSTRAINT fk_billboard_friend_company 
FOREIGN KEY (friend_company_id) REFERENCES friend_companies(id) ON DELETE SET NULL;

-- Create friend_billboard_rentals table to track rentals from friends
CREATE TABLE IF NOT EXISTS friend_billboard_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id BIGINT NOT NULL,
  contract_number BIGINT NOT NULL,
  friend_company_id UUID NOT NULL,
  friend_rental_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_rental_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit NUMERIC(10,2) GENERATED ALWAYS AS (customer_rental_price - friend_rental_cost) STORED,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_friend_rentals_billboard FOREIGN KEY (billboard_id) REFERENCES billboards("ID") ON DELETE CASCADE,
  CONSTRAINT fk_friend_rentals_contract FOREIGN KEY (contract_number) REFERENCES "Contract"("Contract_Number") ON DELETE CASCADE,
  CONSTRAINT fk_friend_rentals_company FOREIGN KEY (friend_company_id) REFERENCES friend_companies(id) ON DELETE RESTRICT,
  UNIQUE(billboard_id, contract_number)
);

-- Add friend_rental_data to Contract table for storing friend rental costs
ALTER TABLE "Contract"
ADD COLUMN IF NOT EXISTS friend_rental_data JSONB;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billboards_friend_company ON billboards(friend_company_id);
CREATE INDEX IF NOT EXISTS idx_friend_rentals_company ON friend_billboard_rentals(friend_company_id);
CREATE INDEX IF NOT EXISTS idx_friend_rentals_contract ON friend_billboard_rentals(contract_number);
CREATE INDEX IF NOT EXISTS idx_friend_rentals_billboard ON friend_billboard_rentals(billboard_id);

-- Enable RLS on friend_companies
ALTER TABLE friend_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage friend companies"
  ON friend_companies
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view friend companies"
  ON friend_companies
  FOR SELECT
  USING (true);

-- Enable RLS on friend_billboard_rentals
ALTER TABLE friend_billboard_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage friend rentals"
  ON friend_billboard_rentals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view friend rentals"
  ON friend_billboard_rentals
  FOR SELECT
  USING (true);

-- Create trigger functions
CREATE OR REPLACE FUNCTION update_friend_companies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_friend_rentals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trg_friend_companies_updated_at ON friend_companies;
CREATE TRIGGER trg_friend_companies_updated_at
BEFORE UPDATE ON friend_companies
FOR EACH ROW
EXECUTE FUNCTION update_friend_companies_updated_at();

DROP TRIGGER IF EXISTS trg_friend_rentals_updated_at ON friend_billboard_rentals;
CREATE TRIGGER trg_friend_rentals_updated_at
BEFORE UPDATE ON friend_billboard_rentals
FOR EACH ROW
EXECUTE FUNCTION update_friend_rentals_updated_at();

-- Create view for friend company financials
CREATE OR REPLACE VIEW friend_company_financials AS
SELECT 
  fc.id AS company_id,
  fc.name AS company_name,
  COUNT(DISTINCT fbr.billboard_id) AS total_billboards,
  COUNT(DISTINCT fbr.contract_number) AS total_contracts,
  COALESCE(SUM(fbr.friend_rental_cost), 0) AS total_paid_to_friend,
  COALESCE(SUM(fbr.customer_rental_price), 0) AS total_revenue_from_customers,
  COALESCE(SUM(fbr.profit), 0) AS total_profit,
  MIN(fbr.start_date) AS first_rental_date,
  MAX(fbr.end_date) AS last_rental_date
FROM friend_companies fc
LEFT JOIN friend_billboard_rentals fbr ON fc.id = fbr.friend_company_id
GROUP BY fc.id, fc.name;