-- تمكين RLS على جداول المهام والدفعات لضمان ظهور البيانات

-- تمكين RLS على جدول installation_tasks
ALTER TABLE installation_tasks ENABLE ROW LEVEL SECURITY;

-- حذف السياسة القديمة إن وجدت وإنشاء سياسة جديدة
DROP POLICY IF EXISTS "Allow authenticated users to view installation tasks" ON installation_tasks;
CREATE POLICY "Allow authenticated users to view installation tasks"
ON installation_tasks FOR SELECT
TO authenticated
USING (true);

-- تمكين RLS على جدول removal_tasks
ALTER TABLE removal_tasks ENABLE ROW LEVEL SECURITY;

-- حذف السياسة القديمة إن وجدت وإنشاء سياسة جديدة
DROP POLICY IF EXISTS "Allow authenticated users to view removal tasks" ON removal_tasks;
CREATE POLICY "Allow authenticated users to view removal tasks"
ON removal_tasks FOR SELECT
TO authenticated
USING (true);

-- تأكد من وجود سياسة القراءة لجدول customer_payments
DROP POLICY IF EXISTS "Allow authenticated users to view payments" ON customer_payments;
CREATE POLICY "Allow authenticated users to view payments"
ON customer_payments FOR SELECT
TO authenticated
USING (true);