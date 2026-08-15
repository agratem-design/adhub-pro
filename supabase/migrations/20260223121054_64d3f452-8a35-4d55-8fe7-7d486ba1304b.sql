INSERT INTO system_settings (setting_key, setting_value)
VALUES ('imgbb_api_key', 'cd5d97c1e36c05e451729b3c16660344')
ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value;