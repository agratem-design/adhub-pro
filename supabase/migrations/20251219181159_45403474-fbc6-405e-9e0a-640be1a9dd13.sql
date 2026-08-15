-- Allow all authenticated users to read installation task items (required for Delayed Billboards screen)
CREATE POLICY "Authenticated users view installation task items"
ON public.installation_task_items
FOR SELECT
TO authenticated
USING (true);
