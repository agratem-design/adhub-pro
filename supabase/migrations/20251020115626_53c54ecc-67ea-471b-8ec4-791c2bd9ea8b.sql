-- Remove authentication requirement for customer_general_discounts
-- This allows authenticated users to access the table without strict auth.uid() checks

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert discounts" ON public.customer_general_discounts;
DROP POLICY IF EXISTS "Authenticated users can update discounts" ON public.customer_general_discounts;
DROP POLICY IF EXISTS "Authenticated users can delete discounts" ON public.customer_general_discounts;
DROP POLICY IF EXISTS "Authenticated users view general discounts" ON public.customer_general_discounts;

-- Create new permissive policies for all authenticated users
CREATE POLICY "Allow all authenticated users full access to discounts"
ON public.customer_general_discounts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);