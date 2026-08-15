-- إضافة سياسة للسماح للمستخدمين المصادق عليهم بإدخال سجلات في billboard_history
CREATE POLICY "Authenticated users can insert billboard history"
ON public.billboard_history
FOR INSERT
TO authenticated
WITH CHECK (true);

-- إضافة سياسة للسماح للمستخدمين المصادق عليهم بتحديث سجلات billboard_history
CREATE POLICY "Authenticated users can update billboard history"
ON public.billboard_history
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);