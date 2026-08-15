CREATE POLICY "Allow authenticated users to view removal task items"
ON public.removal_task_items
FOR SELECT
TO authenticated
USING (true);