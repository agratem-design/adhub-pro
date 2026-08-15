
ALTER TABLE friend_companies 
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS brand_color text,
  ADD COLUMN IF NOT EXISTS company_type text DEFAULT 'friend';

ALTER TABLE installation_teams
  ADD COLUMN IF NOT EXISTS friend_company_ids uuid[];
