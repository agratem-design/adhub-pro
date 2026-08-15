-- إضافة "حساب" إلى القيم المسموح بها في method
ALTER TABLE public.customer_payments 
DROP CONSTRAINT IF EXISTS customer_payments_method_check;

ALTER TABLE public.customer_payments 
ADD CONSTRAINT customer_payments_method_check 
CHECK (method = ANY (ARRAY['نقدي'::text, 'نقد'::text, 'شيك'::text, 'تحويل بنكي'::text, 'بطاقة'::text, 'مقايضة'::text, 'آجل'::text, 'دين سابق'::text, 'حساب'::text]));