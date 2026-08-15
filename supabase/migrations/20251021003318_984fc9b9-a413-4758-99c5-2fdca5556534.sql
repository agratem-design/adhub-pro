-- تحديث جدول pricing ليستخدم size_id=34 للمقاس 12x4/سوسيت
-- أولاً: تحديث الصفوف الموجودة التي تحتوي على size="12x4" لتستخدم size_id=34
UPDATE pricing 
SET size_id = 34 
WHERE size = '12x4' AND size_id = 3;

-- ثانياً: إضافة صفوف بديلة باسم "سوسيت" إذا لم تكن موجودة
INSERT INTO pricing (size, billboard_level, customer_category, one_month, "2_months", "3_months", "6_months", full_year, one_day, size_id)
SELECT 'سوسيت', billboard_level, customer_category, one_month, "2_months", "3_months", "6_months", full_year, one_day, 34
FROM pricing 
WHERE size = '12x4' AND size_id = 34
ON CONFLICT DO NOTHING;