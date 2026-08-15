-- إصلاح policies جدول messaging_api_settings
-- حذف جميع الـ policies الحالية
DROP POLICY IF EXISTS "Authenticated users can insert messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users can update messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users can delete messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users view messaging settings" ON messaging_api_settings;

-- إنشاء policy واحدة للمستخدمين المصادق عليهم
CREATE POLICY "Allow authenticated users full access"
ON messaging_api_settings
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);