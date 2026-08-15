
-- Create team_account_expenses table for additional expenses per billboard
CREATE TABLE public.team_account_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_account_id UUID NOT NULL REFERENCES public.installation_team_accounts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_account_expenses ENABLE ROW LEVEL SECURITY;

-- Allow all access (internal app)
CREATE POLICY "Allow all access to team_account_expenses"
  ON public.team_account_expenses
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX idx_team_account_expenses_account ON public.team_account_expenses(team_account_id);
