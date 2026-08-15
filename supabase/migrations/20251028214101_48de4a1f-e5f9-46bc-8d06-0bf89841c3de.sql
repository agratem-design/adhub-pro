-- تحديث policies جدول messaging_api_settings لإتاحة الحفظ لجميع المستخدمين المصادق عليهم

-- حذف policy الحالية للـ admins
DROP POLICY IF EXISTS "Admins manage messaging settings" ON messaging_api_settings;

-- إضافة policies جديدة
CREATE POLICY "Authenticated users can insert messaging settings"
ON messaging_api_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update messaging settings"
ON messaging_api_settings
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete messaging settings"
ON messaging_api_settings
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);