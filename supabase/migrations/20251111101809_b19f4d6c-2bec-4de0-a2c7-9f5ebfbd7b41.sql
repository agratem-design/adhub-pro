-- إضافة أعمدة جديدة لجدول customer_payments لتسجيل عمولات الوسيط والتحويل

-- إضافة عمولة الوسيط (المبلغ المخصوم من قبل الوسيط)
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS intermediary_commission numeric DEFAULT 0;

-- إضافة عمولة التحويل (رسوم التحويل البنكي أو غيرها)
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS transfer_fee numeric DEFAULT 0;

-- إضافة المبلغ الصافي (المبلغ بعد خصم العمولات)
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS net_amount numeric;

-- إضافة ملاحظات خاصة بالعمولات
ALTER TABLE customer_payments 
ADD COLUMN IF NOT EXISTS commission_notes text;

-- تحديث المبلغ الصافي للصفوف الموجودة (المبلغ = المبلغ الصافي بشكل افتراضي)
UPDATE customer_payments 
SET net_amount = amount 
WHERE net_amount IS NULL;

COMMENT ON COLUMN customer_payments.intermediary_commission IS 'العمولة المخصومة من قبل الوسيط';
COMMENT ON COLUMN customer_payments.transfer_fee IS 'رسوم التحويل أو العمولات الإضافية';
COMMENT ON COLUMN customer_payments.net_amount IS 'المبلغ الصافي بعد خصم جميع العمولات';
COMMENT ON COLUMN customer_payments.commission_notes IS 'ملاحظات إضافية حول العمولات المخصومة';