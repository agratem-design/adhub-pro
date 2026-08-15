-- Fix Misrata spelling: مصراته -> مصراتة

-- 1. Ensure 'مصراتة' exists in cities, then delete the typo 'مصراته'
INSERT INTO public.cities (name)
VALUES ('مصراتة')
ON CONFLICT (name) DO NOTHING;

DELETE FROM public.cities
WHERE name = 'مصراته';

-- 2. Update billboards table
UPDATE public.billboards
SET "City" = 'مصراتة'
WHERE "City" = 'مصراته';

UPDATE public.billboards
SET "Nearest_Landmark" = REPLACE("Nearest_Landmark", 'مصراته', 'مصراتة')
WHERE "Nearest_Landmark" LIKE '%مصراته%';

UPDATE public.billboards
SET "image_name" = REPLACE("image_name", 'مصراته', 'مصراتة')
WHERE "image_name" LIKE '%مصراته%';

-- 3. Update export_city_images table
UPDATE public.export_city_images
SET city_name = 'مصراتة'
WHERE city_name = 'مصراته';

-- 4. Update export_company_images table
UPDATE public.export_company_images
SET company_name = REPLACE(company_name, 'مصراته', 'مصراتة')
WHERE company_name LIKE '%مصراته%';

-- 5. Update billboard_nearby_businesses table
UPDATE public.billboard_nearby_businesses
SET address = REPLACE(address, 'مصراته', 'مصراتة')
WHERE address LIKE '%مصراته%';

UPDATE public.billboard_nearby_businesses
SET business_name = REPLACE(business_name, 'مصراته', 'مصراتة')
WHERE business_name LIKE '%مصراته%';

-- 6. Update municipality_factors table
-- 'مصراتة' already exists in municipality_factors, so we delete the typo 'مصراته'
DELETE FROM public.municipality_factors
WHERE municipality_name = 'مصراته';

-- 7. Update installation_teams table
UPDATE public.installation_teams
SET cities = ARRAY(
  SELECT DISTINCT x
  FROM unnest(array_replace(cities, 'مصراته', 'مصراتة')) AS x
)
WHERE 'مصراته' = ANY(cities);

-- 8. Update Contract table
UPDATE public."Contract"
SET "Ad Type" = REPLACE("Ad Type", 'مصراته', 'مصراتة')
WHERE "Ad Type" LIKE '%مصراته%';

UPDATE public."Contract"
SET "billboards_data" = REPLACE("billboards_data", 'مصراته', 'مصراتة')
WHERE "billboards_data" LIKE '%مصراته%';

-- 9. Update billboard_tags table
UPDATE public.billboard_tags
SET description = REPLACE(description, 'مصراته', 'مصراتة')
WHERE description LIKE '%مصراته%';
