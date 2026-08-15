-- Drop the existing foreign key constraint
ALTER TABLE public.installation_task_items 
DROP CONSTRAINT IF EXISTS installation_task_items_billboard_id_fkey;

-- Re-add the constraint with ON DELETE CASCADE
ALTER TABLE public.installation_task_items
ADD CONSTRAINT installation_task_items_billboard_id_fkey 
FOREIGN KEY (billboard_id) 
REFERENCES public.billboards("ID") 
ON DELETE CASCADE;