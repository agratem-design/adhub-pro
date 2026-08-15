-- تعديل constraint لإضافة textly
ALTER TABLE messaging_api_settings
DROP CONSTRAINT IF EXISTS messaging_api_settings_platform_check;

ALTER TABLE messaging_api_settings
ADD CONSTRAINT messaging_api_settings_platform_check
CHECK (platform = ANY (ARRAY['whatsapp'::text, 'telegram'::text, 'textly'::text]));