-- Update old converted offers to remove "عرض" from Ad Type
UPDATE public."Contract"
SET "Ad Type" = 
  CASE 
    WHEN "Ad Type" LIKE '%عرض سعر%' THEN NULLIF(TRIM(REPLACE("Ad Type", 'عرض سعر', '')), '')
    WHEN "Ad Type" LIKE '%عرض%' THEN NULLIF(TRIM(REPLACE("Ad Type", 'عرض', '')), '')
    ELSE "Ad Type"
  END
WHERE "Ad Type" LIKE '%عرض%';

-- Set default value for any NULL Ad Type after cleanup
UPDATE public."Contract"
SET "Ad Type" = 'إعلان'
WHERE "Ad Type" IS NULL OR "Ad Type" = '';