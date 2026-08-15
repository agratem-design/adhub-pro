
-- Drop and recreate the team_accounts_summary view to calculate from sizes table
DROP VIEW IF EXISTS team_accounts_summary;

CREATE VIEW team_accounts_summary AS
SELECT 
  ta.team_id,
  t.team_name,
  COUNT(*) as total_installations,
  COUNT(*) FILTER (WHERE ta.status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE ta.status = 'paid') as paid_count,
  COALESCE(SUM(COALESCE(s.installation_price, 0)) FILTER (WHERE ta.status = 'pending'), 0) as pending_amount,
  COALESCE(SUM(COALESCE(s.installation_price, 0)) FILTER (WHERE ta.status = 'paid'), 0) as paid_amount,
  COALESCE(SUM(COALESCE(s.installation_price, 0)), 0) as total_amount
FROM installation_team_accounts ta
LEFT JOIN installation_teams t ON ta.team_id = t.id
LEFT JOIN billboards b ON ta.billboard_id = b."ID"
LEFT JOIN sizes s ON b."Size" = s.name
GROUP BY ta.team_id, t.team_name;
