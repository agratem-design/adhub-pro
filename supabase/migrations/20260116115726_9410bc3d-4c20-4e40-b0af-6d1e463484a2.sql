-- إضافة سياسة RLS للسماح للمستخدمين المصادق عليهم بإضافة لوحات
CREATE POLICY "Authenticated users can insert billboards"
ON public.billboards
FOR INSERT
TO authenticated
WITH CHECK (true);

-- إضافة سياسة RLS للسماح للمستخدمين المصادق عليهم بتحديث اللوحات
CREATE POLICY "Authenticated users can update billboards"
ON public.billboards
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);