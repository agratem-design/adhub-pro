-- إضافة عمود الترتيب للمستويات
ALTER TABLE public.billboard_levels 
ADD COLUMN sort_order integer UNIQUE;

-- تحديث الترتيب للمستويات الموجودة
UPDATE public.billboard_levels 
SET sort_order = id 
WHERE sort_order IS NULL;

-- إضافة قيد NOT NULL بعد التحديث
ALTER TABLE public.billboard_levels 
ALTER COLUMN sort_order SET NOT NULL;

-- إضافة قيد افتراضي للترتيب
ALTER TABLE public.billboard_levels 
ALTER COLUMN sort_order SET DEFAULT 0;