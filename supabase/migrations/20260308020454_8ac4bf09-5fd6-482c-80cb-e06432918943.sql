-- إصلاح البيانات الحالية: تحديث GPS_Link المكسور
UPDATE billboards 
SET "GPS_Link" = 'https://www.google.com/maps?q=' || "GPS_Coordinates"
WHERE "GPS_Coordinates" IS NOT NULL 
  AND "GPS_Coordinates" != '' 
  AND "GPS_Coordinates" != '0'
  AND ("GPS_Link" IS NULL OR "GPS_Link" = '' OR "GPS_Link" LIKE '%q=0' OR "GPS_Link" LIKE '%q=0,%');

-- إنشاء دالة تزامن GPS_Link مع GPS_Coordinates
CREATE OR REPLACE FUNCTION public.sync_gps_link_from_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW."GPS_Coordinates" IS NOT NULL 
     AND NEW."GPS_Coordinates" != '' 
     AND NEW."GPS_Coordinates" != '0' THEN
    NEW."GPS_Link" := 'https://www.google.com/maps?q=' || NEW."GPS_Coordinates";
  END IF;
  RETURN NEW;
END;
$function$;

-- إضافة trigger على جدول billboards
DROP TRIGGER IF EXISTS trg_sync_gps_link ON billboards;
CREATE TRIGGER trg_sync_gps_link
  BEFORE INSERT OR UPDATE OF "GPS_Coordinates"
  ON billboards
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_gps_link_from_coordinates();