-- إعادة إضافة صلاحيات المستخدم عبدالملك قراطم
INSERT INTO user_permissions (user_id, permission) VALUES 
('9acf75b8-c78e-4003-b40f-c8876eae8302', 'dashboard'),
('9acf75b8-c78e-4003-b40f-c8876eae8302', 'billboards'),
('9acf75b8-c78e-4003-b40f-c8876eae8302', 'contracts'),
('9acf75b8-c78e-4003-b40f-c8876eae8302', 'customers'),
('9acf75b8-c78e-4003-b40f-c8876eae8302', 'installation_tasks')
ON CONFLICT (user_id, permission) DO NOTHING;