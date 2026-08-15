-- تحديث الترتيب للبلديات بالأسماء الصحيحة
UPDATE public.municipalities SET sort_order = 2 WHERE name = 'حي الأندلس';
UPDATE public.municipalities SET sort_order = 8 WHERE name = 'القره بوللي';

-- التأكد من عدم تكرار الترتيب 2 و 8
UPDATE public.municipalities SET sort_order = sort_order + 10 
WHERE sort_order IN (2, 8) AND name NOT IN ('حي الأندلس', 'القره بوللي');