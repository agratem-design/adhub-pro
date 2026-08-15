-- Update default settings to include all new elements
UPDATE billboard_print_settings 
SET elements = jsonb_set(
  jsonb_set(
    jsonb_set(
      elements::jsonb,
      '{cutoutImage}',
      '{"visible": true, "top": "100mm", "left": "10mm", "width": "80mm", "height": "80mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
    ),
    '{faceAImage}',
    '{"visible": true, "top": "100mm", "left": "10mm", "width": "85mm", "height": "60mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
  ),
  '{faceBImage}',
  '{"visible": true, "top": "165mm", "left": "10mm", "width": "85mm", "height": "60mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
),
updated_at = now()
WHERE setting_key = 'default' 
AND NOT (elements::jsonb ? 'cutoutImage');

-- Also update all other modes
UPDATE billboard_print_settings 
SET elements = jsonb_set(
  jsonb_set(
    jsonb_set(
      elements::jsonb,
      '{cutoutImage}',
      '{"visible": true, "top": "100mm", "left": "10mm", "width": "80mm", "height": "80mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
    ),
    '{faceAImage}',
    '{"visible": true, "top": "100mm", "left": "10mm", "width": "85mm", "height": "60mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
  ),
  '{faceBImage}',
  '{"visible": true, "top": "165mm", "left": "10mm", "width": "85mm", "height": "60mm", "borderWidth": "2px", "borderColor": "#000"}'::jsonb
),
updated_at = now()
WHERE setting_key != 'default' 
AND NOT (elements::jsonb ? 'cutoutImage');