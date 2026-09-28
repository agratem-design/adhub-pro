-- تحديث جميع لوحات مقاس السوسيت لتكون بمستوى B وحذف أي مستويات أخرى للسوسيت من جداول الأسعار
-- 1. تحديث جدول اللوحات billboards
UPDATE public.billboards 
SET "Level" = 'B' 
WHERE ("Size" ILIKE '%سوسيت%' OR size_id = 34 OR "Billboard_Name" ILIKE '%سوسيت%')
  AND ("Level" IS NULL OR "Level" != 'B');

-- تنظيف Category_Level إذا كانت قيمة غير صالحة مثل '0'
UPDATE public.billboards
SET "Category_Level" = NULL
WHERE ("Size" ILIKE '%سوسيت%' OR size_id = 34)
  AND "Category_Level" = '0';

-- 2. تحديث جدول الأسعار الأساسية base_prices
DELETE FROM public.base_prices 
WHERE size_name = 'سوسيت' AND billboard_level != 'B';

INSERT INTO public.base_prices (size_name, billboard_level, one_month, two_months, three_months, six_months, full_year, one_day)
VALUES ('سوسيت', 'B', 250, 400, 600, 800, 1200, 15)
ON CONFLICT (size_name, billboard_level) DO NOTHING;

-- 3. تحديث جدول pricing
UPDATE public.pricing 
SET billboard_level = 'B' 
WHERE size = 'سوسيت' AND billboard_level != 'B';

-- 4. تحديث جدول أسعار التصدير export_pricing
DELETE FROM public.export_pricing 
WHERE size = 'سوسيت' AND billboard_level != 'B';
