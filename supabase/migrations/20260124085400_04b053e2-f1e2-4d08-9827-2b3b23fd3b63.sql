-- =====================================================
-- Fix RLS Policies for reports, tasks, and report_items
-- Drop ALL existing policies first, then create secure ones
-- =====================================================

-- Drop ALL existing policies on reports
DROP POLICY IF EXISTS "reports_select_all" ON public.reports;
DROP POLICY IF EXISTS "reports_insert_all" ON public.reports;
DROP POLICY IF EXISTS "reports_update_all" ON public.reports;
DROP POLICY IF EXISTS "reports_delete_all" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can delete reports" ON public.reports;

-- Drop ALL existing policies on tasks
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_all" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

-- Drop ALL existing policies on report_items
DROP POLICY IF EXISTS "report_items_select_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_insert_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_update_all" ON public.report_items;
DROP POLICY IF EXISTS "report_items_delete_all" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can view report_items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can create report_items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can update report_items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can delete report_items" ON public.report_items;

-- Create secure policies for reports - authenticated users only
CREATE POLICY "reports_select_authenticated" 
  ON public.reports FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "reports_insert_authenticated" 
  ON public.reports FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "reports_update_authenticated" 
  ON public.reports FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "reports_delete_authenticated" 
  ON public.reports FOR DELETE 
  TO authenticated 
  USING (true);

-- Create secure policies for tasks - authenticated users only
CREATE POLICY "tasks_select_authenticated" 
  ON public.tasks FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "tasks_insert_authenticated" 
  ON public.tasks FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "tasks_update_authenticated" 
  ON public.tasks FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "tasks_delete_authenticated" 
  ON public.tasks FOR DELETE 
  TO authenticated 
  USING (true);

-- Create secure policies for report_items - authenticated users only
CREATE POLICY "report_items_select_authenticated" 
  ON public.report_items FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "report_items_insert_authenticated" 
  ON public.report_items FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "report_items_update_authenticated" 
  ON public.report_items FOR UPDATE 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "report_items_delete_authenticated" 
  ON public.report_items FOR DELETE 
  TO authenticated 
  USING (true);