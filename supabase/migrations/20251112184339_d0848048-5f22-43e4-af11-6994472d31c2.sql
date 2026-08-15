-- حذف السياسة القديمة التي تقيد الإدارة على الأدمن فقط
DROP POLICY IF EXISTS "Admins manage task designs" ON task_designs;

-- إنشاء سياسات RLS جديدة للسماح للمستخدمين المصادقين بإدارة التصاميم
CREATE POLICY "Authenticated users can insert task designs"
ON task_designs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update task designs"
ON task_designs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete task designs"
ON task_designs
FOR DELETE
TO authenticated
USING (true);

-- تحديث سياسة القراءة لتكون أكثر وضوحاً
DROP POLICY IF EXISTS "Authenticated users view task designs" ON task_designs;
CREATE POLICY "Authenticated users can view task designs"
ON task_designs
FOR SELECT
TO authenticated
USING (true);