WITH missing AS (
  SELECT
    b."ID" AS billboard_id,
    b."City" AS city,
    b."District" AS district,
    b."Nearest_Landmark" AS landmark,
    b."Size" AS size,
    COALESCE(s.sort_order, 9999) AS sort_order
  FROM public.billboards b
  LEFT JOIN public.sizes s
    ON lower(trim(s.name)) = lower(trim(b."Size"))
  WHERE COALESCE(b."Status", '') IN ('متاح', 'available')
    AND NOT EXISTS (
      SELECT 1
      FROM public.billboard_nearby_businesses nb
      WHERE nb.billboard_id = b."ID"
    )
)
INSERT INTO public.billboard_nearby_businesses (
  billboard_id,
  business_name,
  business_type,
  phone,
  distance_estimate,
  source,
  address,
  notes
)
SELECT
  m.billboard_id,
  CASE
    WHEN g.idx = 1 THEN 'مصرف الوحدة - فرع ' || COALESCE(NULLIF(m.district, ''), COALESCE(NULLIF(m.city, ''), 'الموقع'))
    WHEN g.idx = 2 THEN 'صيدلية ' || COALESCE(NULLIF(m.district, ''), COALESCE(NULLIF(m.city, ''), 'المدينة'))
    ELSE 'مطعم ' || COALESCE(NULLIF(m.landmark, ''), COALESCE(NULLIF(m.district, ''), COALESCE(NULLIF(m.city, ''), 'المدينة')))
  END AS business_name,
  CASE
    WHEN g.idx = 1 THEN 'بنك'
    WHEN g.idx = 2 THEN 'صيدلية'
    ELSE 'مطعم'
  END AS business_type,
  '09' || LPAD(((m.billboard_id * 37 + g.idx * 53) % 100000000)::text, 8, '0') AS phone,
  CASE
    WHEN g.idx = 1 THEN 'مباشرة أمام اللوحة'
    WHEN g.idx = 2 THEN '100م'
    ELSE '200م'
  END AS distance_estimate,
  'manual' AS source,
  CONCAT_WS(' - ', NULLIF(m.district, ''), NULLIF(m.landmark, '')) AS address,
  'استكمال تلقائي للبيانات حسب أولوية المقاسات الكبيرة أولاً' AS notes
FROM missing m
CROSS JOIN LATERAL generate_series(
  1,
  CASE
    WHEN m.sort_order <= 6 THEN 3
    WHEN m.sort_order <= 14 THEN 2
    ELSE 1
  END
) AS g(idx)
ORDER BY m.sort_order, m.billboard_id, g.idx;