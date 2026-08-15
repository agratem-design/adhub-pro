-- Drop and recreate the INSERT policy for customer_payments
DROP POLICY IF EXISTS "Authenticated users can insert payments" ON public.customer_payments;

-- Create a new INSERT policy that explicitly allows all authenticated users
CREATE POLICY "Authenticated users can insert payments"
ON public.customer_payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also ensure UPDATE and DELETE policies work correctly for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.customer_payments;

CREATE POLICY "Authenticated users can update payments"
ON public.customer_payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Keep the delete restricted to admins but allow others to see their payments
DROP POLICY IF EXISTS "Admins can delete payments" ON public.customer_payments;

CREATE POLICY "Admins can delete payments"
ON public.customer_payments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));