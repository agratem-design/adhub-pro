
-- Add sequential task_number to composite_tasks
ALTER TABLE public.composite_tasks ADD COLUMN IF NOT EXISTS task_number SERIAL;

-- Create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_composite_tasks_task_number ON public.composite_tasks(task_number);
