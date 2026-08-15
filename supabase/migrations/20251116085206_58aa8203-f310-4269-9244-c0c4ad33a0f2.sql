-- إضافة حقول اسم المستلم واسم المسلم لجدول expenses
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS receiver_name text,
ADD COLUMN IF NOT EXISTS sender_name text;

COMMENT ON COLUMN expenses.receiver_name IS 'اسم مستلم المبلغ';
COMMENT ON COLUMN expenses.sender_name IS 'اسم المسلم (المدير أو المسؤول)';