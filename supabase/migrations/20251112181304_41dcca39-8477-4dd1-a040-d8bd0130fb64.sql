-- Create task_designs table to store design templates for each installation task
CREATE TABLE IF NOT EXISTS public.task_designs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.installation_tasks(id) ON DELETE CASCADE,
  design_name TEXT NOT NULL,
  design_url TEXT NOT NULL,
  design_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_designs ENABLE ROW LEVEL SECURITY;

-- Create policies for task_designs
CREATE POLICY "Admins manage task designs"
ON public.task_designs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Authenticated users view task designs"
ON public.task_designs
FOR SELECT
TO authenticated
USING (true);

-- Add selected_design_id to installation_task_items to track which design is selected for each billboard
ALTER TABLE public.installation_task_items
ADD COLUMN IF NOT EXISTS selected_design_id UUID REFERENCES public.task_designs(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_task_designs_task_id ON public.task_designs(task_id);
CREATE INDEX IF NOT EXISTS idx_installation_task_items_selected_design ON public.installation_task_items(selected_design_id);