-- حذف السجلات المكررة من billboard_history
DELETE FROM billboard_history a
USING billboard_history b
WHERE a.id > b.id
  AND a.billboard_id = b.billboard_id
  AND a.contract_number = b.contract_number
  AND COALESCE(a.installation_date::text, '') = COALESCE(b.installation_date::text, '');