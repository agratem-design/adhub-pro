-- إزالة القيد الفريد لمهام التركيب للسماح بإعادة التركيب المتعددة لنفس العقد
ALTER TABLE installation_tasks 
DROP CONSTRAINT IF EXISTS installation_tasks_contract_team_unique;

-- إضافة index عادي (غير فريد) لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_installation_tasks_contract_team 
ON installation_tasks(contract_id, team_id);