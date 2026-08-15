-- تحديث السجلات السابقة التي ليس لها نوع إعلان
UPDATE activity_log al
SET ad_type = c."Ad Type"
FROM "Contract" c
WHERE al.contract_number = c."Contract_Number"
  AND al.ad_type IS NULL
  AND al.entity_type = 'composite_task';