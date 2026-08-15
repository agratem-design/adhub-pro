-- إضافة unique constraint على platform إذا لم يكن موجوداً
ALTER TABLE messaging_api_settings 
DROP CONSTRAINT IF EXISTS messaging_api_settings_platform_key;

ALTER TABLE messaging_api_settings 
ADD CONSTRAINT messaging_api_settings_platform_key UNIQUE (platform);