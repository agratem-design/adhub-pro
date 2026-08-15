-- Add unique constraint for installation_team_id to ensure one employee per team
ALTER TABLE employees 
  DROP CONSTRAINT IF EXISTS unique_installation_team_id;

ALTER TABLE employees 
  ADD CONSTRAINT unique_installation_team_id 
  UNIQUE (installation_team_id);

-- Create employee_manual_tasks table for tracking manual work
CREATE TABLE IF NOT EXISTS employee_manual_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  operating_cost NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add RLS policies
ALTER TABLE employee_manual_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage employee manual tasks"
  ON employee_manual_tasks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view employee manual tasks"
  ON employee_manual_tasks
  FOR SELECT
  USING (true);

-- Add index for faster queries
CREATE INDEX idx_employee_manual_tasks_employee_id ON employee_manual_tasks(employee_id);
CREATE INDEX idx_employee_manual_tasks_task_date ON employee_manual_tasks(task_date);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_employee_manual_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_employee_manual_tasks_updated_at
  BEFORE UPDATE ON employee_manual_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_manual_tasks_updated_at();