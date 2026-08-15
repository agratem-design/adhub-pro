-- 1. تحديث اللوحات بمقاسات 13x5, 12x4, 10x4 لتكون "تيبول"
UPDATE billboards 
SET billboard_type = 'تيبول', updated_at = now()
WHERE "Size" IN ('13x5', '12x4', '10x4') 
  AND (billboard_type IS DISTINCT FROM 'تيبول');

-- 2. تحديث اللوحات التي نوعها غير صحيح (ليس عادية/تيبول/برجية) لتكون "برجية"
UPDATE billboards
SET billboard_type = 'برجية', updated_at = now()
WHERE billboard_type IS NOT NULL 
  AND billboard_type != ''
  AND billboard_type NOT IN ('عادية', 'تيبول', 'برجية');