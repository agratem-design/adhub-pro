-- Update RLS policies for customer_general_discounts table
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admins manage general discounts" ON public.customer_general_discounts;

-- Create new policies that allow authenticated users to manage discounts
CREATE POLICY "Authenticated users can insert discounts"
ON public.customer_general_discounts
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update discounts"
ON public.customer_general_discounts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete discounts"
ON public.customer_general_discounts
FOR DELETE
TO authenticated
USING (true);