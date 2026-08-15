-- Create removal_tasks table (similar to installation_tasks)
CREATE TABLE IF NOT EXISTS public.removal_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id BIGINT NOT NULL,
  contract_ids BIGINT[] DEFAULT ARRAY[]::BIGINT[],
  team_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create removal_task_items table (similar to installation_task_items)
CREATE TABLE IF NOT EXISTS public.removal_task_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.removal_tasks(id) ON DELETE CASCADE,
  billboard_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMP WITH TIME ZONE,
  removal_date DATE,
  notes TEXT,
  removed_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.removal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_task_items ENABLE ROW LEVEL SECURITY;

-- Create policies for removal_tasks
CREATE POLICY "Admins manage removal tasks"
ON public.removal_tasks
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for removal_task_items
CREATE POLICY "Admins manage removal task items"
ON public.removal_task_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_removal_tasks_contract_id ON public.removal_tasks(contract_id);
CREATE INDEX IF NOT EXISTS idx_removal_tasks_team_id ON public.removal_tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_removal_tasks_status ON public.removal_tasks(status);
CREATE INDEX IF NOT EXISTS idx_removal_task_items_task_id ON public.removal_task_items(task_id);
CREATE INDEX IF NOT EXISTS idx_removal_task_items_billboard_id ON public.removal_task_items(billboard_id);
CREATE INDEX IF NOT EXISTS idx_removal_task_items_status ON public.removal_task_items(status);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_removal_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_removal_tasks_timestamp
BEFORE UPDATE ON public.removal_tasks
FOR EACH ROW
EXECUTE FUNCTION update_removal_tasks_updated_at();