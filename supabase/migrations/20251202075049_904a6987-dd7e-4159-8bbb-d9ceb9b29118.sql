-- إضافة عمود is_closed لجدول period_closures
ALTER TABLE period_closures 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- تعيين الفترات القديمة كمغلقة (يمكن تعديل هذا حسب الحاجة)
UPDATE period_closures 
SET is_closed = TRUE 
WHERE closure_date < CURRENT_DATE - INTERVAL '30 days';

-- إضافة فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_period_closures_is_closed ON period_closures(is_closed);