-- حذف السياسة القديمة المقيدة
DROP POLICY IF EXISTS "Only admins can manage billboard print settings" ON billboard_print_settings;

-- إنشاء سياسة جديدة تسمح لجميع المستخدمين المسجلين بإدارة الإعدادات
CREATE POLICY "Authenticated users can manage billboard print settings"
ON billboard_print_settings
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);