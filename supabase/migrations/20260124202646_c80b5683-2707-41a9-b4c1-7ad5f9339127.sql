-- Allow contract_id to be NULL for manual removal tasks
ALTER TABLE public.removal_tasks ALTER COLUMN contract_id DROP NOT NULL;