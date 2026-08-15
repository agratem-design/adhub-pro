-- إضافة عمود contract_ids لدعم عقود متعددة في مهمة تركيب واحدة
ALTER TABLE installation_tasks 
ADD COLUMN IF NOT EXISTS contract_ids bigint[] DEFAULT ARRAY[]::bigint[];

-- تحديث البيانات الموجودة: نسخ contract_id إلى contract_ids
UPDATE installation_tasks 
SET contract_ids = ARRAY[contract_id]::bigint[]
WHERE contract_id IS NOT NULL AND (contract_ids IS NULL OR array_length(contract_ids, 1) IS NULL);

-- إضافة تعليق على العمود الجديد
COMMENT ON COLUMN installation_tasks.contract_ids IS 'قائمة أرقام العقود المرتبطة بمهمة التركيب - لدعم تغيير الدعاية لعقود متعددة';