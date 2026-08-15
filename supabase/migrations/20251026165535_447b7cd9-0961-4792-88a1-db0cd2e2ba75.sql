-- Drop and recreate RLS policies for reports
DROP POLICY IF EXISTS "Allow all operations on reports" ON public.reports;
CREATE POLICY "Authenticated users manage reports"
ON public.reports
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Drop and recreate RLS policies for tasks
DROP POLICY IF EXISTS "Allow all operations on tasks" ON public.tasks;
CREATE POLICY "Authenticated users manage tasks"
ON public.tasks
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Drop and recreate RLS policies for report_items
DROP POLICY IF EXISTS "Allow all operations on report_items" ON public.report_items;
CREATE POLICY "Authenticated users manage report_items"
ON public.report_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);