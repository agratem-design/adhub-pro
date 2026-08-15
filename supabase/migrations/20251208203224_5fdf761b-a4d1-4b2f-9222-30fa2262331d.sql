-- إزالة عمود level من جدول pricing_categories وجعل الفئات عامة
ALTER TABLE pricing_categories DROP COLUMN IF EXISTS level;

-- إضافة الفئات الناقصة (الموجودة في pricing لكن ليست في pricing_categories)
INSERT INTO pricing_categories (name)
SELECT DISTINCT customer_category 
FROM pricing 
WHERE customer_category IS NOT NULL 
  AND customer_category NOT IN (SELECT name FROM pricing_categories)
ON CONFLICT DO NOTHING;