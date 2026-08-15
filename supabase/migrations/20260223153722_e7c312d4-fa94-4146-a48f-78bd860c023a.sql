
-- Add image upload provider and freeimage API key settings
INSERT INTO system_settings (setting_key, setting_value)
VALUES 
  ('image_upload_provider', 'imgbb'),
  ('freeimage_api_key', '')
ON CONFLICT (setting_key) DO NOTHING;
