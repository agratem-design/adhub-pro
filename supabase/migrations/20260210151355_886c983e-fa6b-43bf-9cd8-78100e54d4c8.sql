-- Fix billboard names for IDs 1015-1074 to use actual DB ID
-- Format: MunicipalityCode + '0' + ID (e.g., ZL01015)
UPDATE billboards 
SET "Billboard_Name" = 'ZL0' || "ID"::text,
    image_name = 'ZL0' || "ID"::text || '.jpg'
WHERE "ID" >= 1015 AND "ID" <= 1074;