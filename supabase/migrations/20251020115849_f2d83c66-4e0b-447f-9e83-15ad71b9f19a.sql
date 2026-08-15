-- Grant anonymous (anon) access for current UI (no Supabase Auth in use)
-- NOTE: This is limited to customer_general_discounts only

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.customer_general_discounts ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for anon role to manage discounts
DROP POLICY IF EXISTS "Anon can manage general discounts" ON public.customer_general_discounts;
CREATE POLICY "Anon can manage general discounts"
ON public.customer_general_discounts
FOR ALL
TO anon
USING (true)
WITH CHECK (true);