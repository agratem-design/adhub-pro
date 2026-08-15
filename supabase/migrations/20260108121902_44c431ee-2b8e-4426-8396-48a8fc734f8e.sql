-- Add RLS policy for employees table to allow users with custody permission to read employee names
CREATE POLICY "Users with custody permission can view employees"
ON public.employees
FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'custody'));