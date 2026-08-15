-- إضافة سياسات RLS للسماح بإضافة وتعديل وحذف الأحجام
-- حذف السياسة القديمة إن وجدت
DROP POLICY IF EXISTS "Anyone can access sizes" ON sizes;
DROP POLICY IF EXISTS "Allow all operations on sizes" ON sizes;
DROP POLICY IF EXISTS "Enable read access for all" ON sizes;
DROP POLICY IF EXISTS "Enable insert for all" ON sizes;
DROP POLICY IF EXISTS "Enable update for all" ON sizes;
DROP POLICY IF EXISTS "Enable delete for all" ON sizes;

-- إنشاء سياسات جديدة شاملة
CREATE POLICY "Enable read access for all" ON sizes FOR SELECT USING (true);
CREATE POLICY "Enable insert for all" ON sizes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all" ON sizes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON sizes FOR DELETE USING (true);