-- إضافة عمود distributed_payment_id إلى جدول expenses_withdrawals
ALTER TABLE public.expenses_withdrawals 
ADD COLUMN IF NOT EXISTS distributed_payment_id text;

-- إنشاء فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_expenses_withdrawals_distributed_payment_id 
ON public.expenses_withdrawals(distributed_payment_id);

-- التعليق
COMMENT ON COLUMN public.expenses_withdrawals.distributed_payment_id IS 'رقم الدفعة الموزعة المرتبط بهذا السحب';