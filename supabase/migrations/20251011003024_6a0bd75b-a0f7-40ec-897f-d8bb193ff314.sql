-- Enable RLS and add policies for expenses_withdrawals table
ALTER TABLE public.expenses_withdrawals ENABLE ROW LEVEL SECURITY;

-- Allow all operations on expenses_withdrawals
CREATE POLICY "Allow all operations on expenses_withdrawals"
ON public.expenses_withdrawals
FOR ALL
USING (true)
WITH CHECK (true);

-- Ensure period_closures has proper RLS
ALTER TABLE public.period_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_period_closures" ON public.period_closures;

CREATE POLICY "Allow all operations on period_closures"
ON public.period_closures
FOR ALL
USING (true)
WITH CHECK (true);