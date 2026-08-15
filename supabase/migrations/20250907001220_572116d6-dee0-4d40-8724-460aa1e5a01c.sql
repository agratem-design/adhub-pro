-- إنشاء سياسات RLS للقراءة العامة
CREATE POLICY "Enable read access for all users" ON public.billboards FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public."Contract" FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON public.pricing FOR SELECT USING (true);