-- إضافة حقل لربط العهدة بمصدر الدفعة
ALTER TABLE custody_accounts 
ADD COLUMN IF NOT EXISTS source_payment_id text,
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'manual';

-- إضافة تعليق توضيحي
COMMENT ON COLUMN custody_accounts.source_payment_id IS 'معرف الدفعة المصدرية (distributed_payment_id أو payment_id)';
COMMENT ON COLUMN custody_accounts.source_type IS 'نوع المصدر: manual أو payment أو distributed_payment';