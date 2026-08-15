-- Add linked_friend_company_id column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS linked_friend_company_id UUID REFERENCES friend_companies(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_linked_friend_company 
ON customers(linked_friend_company_id);

-- Comment explaining the column
COMMENT ON COLUMN customers.linked_friend_company_id IS 'Links customer to a friend company - payments to this friend company will appear as purchases in customer billing';
