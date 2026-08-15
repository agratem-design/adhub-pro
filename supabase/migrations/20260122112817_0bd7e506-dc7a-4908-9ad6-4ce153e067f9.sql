-- تحديث سياسة customer_payments للسماح لجميع المستخدمين المصادق عليهم بإضافة المدفوعات
DROP POLICY IF EXISTS "Admins manage payments" ON public.customer_payments;

-- سياسة للقراءة (موجودة مسبقاً)
DROP POLICY IF EXISTS "Allow authenticated users to view payments" ON public.customer_payments;
DROP POLICY IF EXISTS "Authenticated users view payments" ON public.customer_payments;

CREATE POLICY "Authenticated users view payments" ON public.customer_payments
  FOR SELECT TO authenticated
  USING (true);

-- سياسة للإضافة - السماح لجميع المستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can insert payments" ON public.customer_payments
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- سياسة للتحديث - السماح لجميع المستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can update payments" ON public.customer_payments
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- سياسة للحذف - فقط للمدراء
CREATE POLICY "Admins can delete payments" ON public.customer_payments
  FOR DELETE TO authenticated
  USING (public.has_role((select auth.uid()), 'admin'));