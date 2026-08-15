-- إضافة RLS policies للـ view

-- السماح لجميع المستخدمين المسجلين بقراءة ملخص حسابات الفرق
DROP POLICY IF EXISTS "Authenticated users view team summary" ON team_accounts_summary;

-- Note: Views don't have RLS, we need to ensure the underlying table has proper policies
-- The view team_accounts_summary already uses installation_team_accounts which has RLS

-- تأكد من وجود index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_team_accounts_team_status 
ON installation_team_accounts(team_id, status);

CREATE INDEX IF NOT EXISTS idx_team_accounts_amount 
ON installation_team_accounts(amount) 
WHERE status = 'pending';