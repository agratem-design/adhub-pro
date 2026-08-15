-- تحديث إعدادات طباعة الجدول بتنسيق fares2 الجديد (أسود وذهبي)
UPDATE billboard_print_settings 
SET elements = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          elements::jsonb,
          '{header_bg_color}', '"#000000"'::jsonb
        ),
        '{header_text_color}', '"#E8CC64"'::jsonb
      ),
      '{first_column_bg_color}', '"#E8CC64"'::jsonb
    ),
    '{first_column_text_color}', '"#000000"'::jsonb
  ),
  '{border_color}', '"#000000"'::jsonb
),
updated_at = now()
WHERE setting_key = 'table_print_default';