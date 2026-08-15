-- إضافة الحقول المطلوبة بدون foreign keys أولاً
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS billboard_id BIGINT;

-- إنشاء فهارس للأداء
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_billboard_id ON "Contract"(billboard_id);