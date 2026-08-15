-- إزالة السياسة القديمة التي تستخدم معامل app.current_customer غير الموجود
DROP POLICY IF EXISTS contract_insert_policy ON "Contract";

-- إزالة السياسات القديمة الأخرى المكررة
DROP POLICY IF EXISTS contract_select_policy ON "Contract";
DROP POLICY IF EXISTS contract_update_policy ON "Contract";
DROP POLICY IF EXISTS update_contracts_policy ON "Contract";

-- التأكد من وجود السياسات الصحيحة فقط (Admins manage contracts و Authenticated users view contracts)
-- هذه السياسات موجودة بالفعل وتعمل بشكل صحيح