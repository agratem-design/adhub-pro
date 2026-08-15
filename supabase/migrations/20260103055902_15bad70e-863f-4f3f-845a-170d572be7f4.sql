-- Update team_accounts_summary to use size-based installation prices when account amount is 0
-- and still respect manual overrides stored in installation_team_accounts.amount.

CREATE OR REPLACE VIEW public.team_accounts_summary AS
SELECT
  ta.team_id,
  t.team_name,
  COUNT(ta.id) AS total_installations,
  COUNT(CASE WHEN ta.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN ta.status = 'paid' THEN 1 END) AS paid_count,
  COALESCE(SUM(CASE WHEN ta.status = 'pending' THEN COALESCE(NULLIF(ta.amount, 0::numeric), s.installation_price, 0::numeric) ELSE 0::numeric END), 0::numeric) AS pending_amount,
  COALESCE(SUM(CASE WHEN ta.status = 'paid' THEN COALESCE(NULLIF(ta.amount, 0::numeric), s.installation_price, 0::numeric) ELSE 0::numeric END), 0::numeric) AS paid_amount,
  COALESCE(SUM(COALESCE(NULLIF(ta.amount, 0::numeric), s.installation_price, 0::numeric)), 0::numeric) AS total_amount
FROM public.installation_team_accounts ta
JOIN public.installation_teams t
  ON t.id = ta.team_id
LEFT JOIN public.billboards b
  ON b."ID" = ta.billboard_id
LEFT JOIN public.sizes s
  ON s.name = b."Size"
GROUP BY ta.team_id, t.team_name;