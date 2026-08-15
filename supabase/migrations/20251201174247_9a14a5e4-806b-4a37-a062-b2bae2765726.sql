-- Add installation_team_id to employees (will error if exists, that's ok)
ALTER TABLE public.employees ADD COLUMN installation_team_id UUID REFERENCES public.installation_teams(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_employees_installation_team ON public.employees(installation_team_id);