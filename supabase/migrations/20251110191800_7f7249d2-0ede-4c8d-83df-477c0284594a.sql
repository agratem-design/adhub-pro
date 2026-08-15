-- إضافة حقول الوسيط المحصل لجدول customer_payments
ALTER TABLE customer_payments
ADD COLUMN IF NOT EXISTS collected_via_intermediary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS collector_name text,
ADD COLUMN IF NOT EXISTS receiver_name text,
ADD COLUMN IF NOT EXISTS delivery_location text;

-- إضافة تعليق على الأعمدة
COMMENT ON COLUMN customer_payments.collected_via_intermediary IS 'هل تم القبض عن طريق وسيط';
COMMENT ON COLUMN customer_payments.collector_name IS 'اسم المحصل (الذي استلم من الزبون)';
COMMENT ON COLUMN customer_payments.receiver_name IS 'اسم المسلم له (المدير)';
COMMENT ON COLUMN customer_payments.delivery_location IS 'مكان تسليم المبلغ';