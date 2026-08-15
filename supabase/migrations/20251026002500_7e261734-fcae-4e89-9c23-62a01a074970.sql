-- إضافة "مقايضة" إلى طرق الدفع المسموحة مع الاحتفاظ بالقيم الحالية
ALTER TABLE customer_payments DROP CONSTRAINT IF EXISTS customer_payments_method_check;

ALTER TABLE customer_payments 
ADD CONSTRAINT customer_payments_method_check 
CHECK (method IN ('نقدي', 'نقد', 'شيك', 'تحويل بنكي', 'بطاقة', 'مقايضة', 'آجل', 'دين سابق'));