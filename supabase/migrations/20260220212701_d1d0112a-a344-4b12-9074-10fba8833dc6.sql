
-- Add reinstallation_number column
ALTER TABLE public.installation_tasks 
ADD COLUMN IF NOT EXISTS reinstallation_number integer DEFAULT NULL;

-- Backfill existing reinstallation tasks with numbering per contract
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY contract_id ORDER BY created_at ASC) as rn
  FROM installation_tasks
  WHERE task_type = 'reinstallation'
)
UPDATE installation_tasks t
SET reinstallation_number = n.rn
FROM numbered n
WHERE t.id = n.id;
