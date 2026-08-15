
-- Clean up duplicate history records
DELETE FROM billboard_history
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY billboard_id, contract_number, installation_date 
        ORDER BY created_at ASC
      ) AS rn
    FROM billboard_history
  ) t
  WHERE rn > 1
);
