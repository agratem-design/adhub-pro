-- تعطيل RLS على جدول messaging_api_settings لأنه جدول إعدادات
ALTER TABLE messaging_api_settings DISABLE ROW LEVEL SECURITY;

-- حذف جميع الـ policies
DROP POLICY IF EXISTS "Allow authenticated users full access" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users can delete messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users can insert messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users can update messaging settings" ON messaging_api_settings;
DROP POLICY IF EXISTS "Authenticated users view messaging settings" ON messaging_api_settings;