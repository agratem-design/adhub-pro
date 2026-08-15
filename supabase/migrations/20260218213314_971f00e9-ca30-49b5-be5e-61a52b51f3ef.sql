
ALTER TABLE public.installation_task_items
ADD COLUMN IF NOT EXISTS faces_to_install INTEGER DEFAULT 1;

NOTIFY pgrst, 'reload schema';
