-- إضافة عمود الترتيب للبلديات
ALTER TABLE public.municipalities 
ADD COLUMN sort_order integer UNIQUE;

-- تحديث الترتيب للبلديات المحددة
UPDATE public.municipalities SET sort_order = 1 WHERE name = 'جنزور';
UPDATE public.municipalities SET sort_order = 2 WHERE name = 'حي الاندلس';
UPDATE public.municipalities SET sort_order = 3 WHERE name = 'طرابلس المركز';
UPDATE public.municipalities SET sort_order = 4 WHERE name = 'سوق الجمعة';
UPDATE public.municipalities SET sort_order = 5 WHERE name = 'بوسليم';
UPDATE public.municipalities SET sort_order = 6 WHERE name = 'عين زارة';
UPDATE public.municipalities SET sort_order = 7 WHERE name = 'تاجوراء';
UPDATE public.municipalities SET sort_order = 8 WHERE name = 'القرة بوللي';
UPDATE public.municipalities SET sort_order = 9 WHERE name = 'الخمس';
UPDATE public.municipalities SET sort_order = 10 WHERE name = 'زليتن';
UPDATE public.municipalities SET sort_order = 11 WHERE name = 'الولية';

-- تحديث الترتيب للبلديات الأخرى بترتيب عشوائي
WITH remaining AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY RANDOM()) + 11 as new_order
  FROM public.municipalities
  WHERE sort_order IS NULL
)
UPDATE public.municipalities m
SET sort_order = r.new_order
FROM remaining r
WHERE m.id = r.id;

-- إضافة قيد NOT NULL
ALTER TABLE public.municipalities 
ALTER COLUMN sort_order SET NOT NULL;

-- إضافة قيمة افتراضية
ALTER TABLE public.municipalities 
ALTER COLUMN sort_order SET DEFAULT 999;