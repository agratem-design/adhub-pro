-- Ensure RLS is enabled and permissive policies exist for reports, tasks, and report_items

-- Enable RLS on tables (safe to run multiple times)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;

-- Clean up old policies if present
DROP POLICY IF EXISTS "Authenticated users manage reports" ON public.reports;
DROP POLICY IF EXISTS "Allow all operations on reports" ON public.reports;
DROP POLICY IF EXISTS "reports_select_all" ON public.reports;
DROP POLICY IF EXISTS "reports_insert_all" ON public.reports;
DROP POLICY IF EXISTS "reports_update_all" ON public.reports;
DROP POLICY IF EXISTS "reports_delete_all" ON public.reports;

DROP POLICY IF EXISTS "Authenticated users manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow all operations on tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_all" ON public.tasks;

DROP POLICY IF EXISTS "Authenticated users manage report_items" ON public.report_items;
DROP POLICY IF EXISTS "Allow all operations on report_items" ON public.report_items;
DROP POLICY IF EXISTS "report_items_select_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_insert_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_update_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_delete_all" ON public.report_items;

-- Create explicit permissive policies (both anon and authenticated via TO public)
-- reports
CREATE POLICY reports_select_all ON public.reports FOR SELECT TO public USING (true);
CREATE POLICY reports_insert_all ON public.reports FOR INSERT TO public WITH CHECK (true);
CREATE POLICY reports_update_all ON public.reports FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY reports_delete_all ON public.reports FOR DELETE TO public USING (true);

-- tasks
CREATE POLICY tasks_select_all ON public.tasks FOR SELECT TO public USING (true);
CREATE POLICY tasks_insert_all ON public.tasks FOR INSERT TO public WITH CHECK (true);
CREATE POLICY tasks_update_all ON public.tasks FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY tasks_delete_all ON public.tasks FOR DELETE TO public USING (true);

-- report_items
CREATE POLICY report_items_select_all ON public.report_items FOR SELECT TO public USING (true);
CREATE POLICY report_items_insert_all ON public.report_items FOR INSERT TO public WITH CHECK (true);
CREATE POLICY report_items_update_all ON public.report_items FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY report_items_delete_all ON public.report_items FOR DELETE TO public USING (true);
