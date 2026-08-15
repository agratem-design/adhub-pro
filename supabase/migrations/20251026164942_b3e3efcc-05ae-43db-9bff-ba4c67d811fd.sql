-- إصلاح سياسات RLS للجداول tasks, reports, report_items

-- حذف السياسات القديمة
DROP POLICY IF EXISTS "Authenticated users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can delete tasks" ON public.tasks;

DROP POLICY IF EXISTS "Authenticated users can view reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can create reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can update reports" ON public.reports;
DROP POLICY IF EXISTS "Authenticated users can delete reports" ON public.reports;

DROP POLICY IF EXISTS "Authenticated users can view report items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can create report items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can update report items" ON public.report_items;
DROP POLICY IF EXISTS "Authenticated users can delete report items" ON public.report_items;

-- إنشاء سياسات جديدة مع أذونات صحيحة

-- Tasks policies
CREATE POLICY "Enable read access for all authenticated users"
  ON public.tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable insert for authenticated users"
  ON public.tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
  ON public.tasks FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
  ON public.tasks FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Reports policies
CREATE POLICY "Enable read access for all authenticated users"
  ON public.reports FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable insert for authenticated users"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
  ON public.reports FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
  ON public.reports FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Report items policies
CREATE POLICY "Enable read access for all authenticated users"
  ON public.report_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Enable insert for authenticated users"
  ON public.report_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users"
  ON public.report_items FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable delete for authenticated users"
  ON public.report_items FOR DELETE
  USING (auth.uid() IS NOT NULL);