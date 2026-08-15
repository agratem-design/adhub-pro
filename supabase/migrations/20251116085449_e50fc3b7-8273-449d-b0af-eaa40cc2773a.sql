-- إضافة حقول اسم المستلم واسم المسلم لجدول expenses_withdrawals
ALTER TABLE expenses_withdrawals
ADD COLUMN IF NOT EXISTS receiver_name text,
ADD COLUMN IF NOT EXISTS sender_name text;

COMMENT ON COLUMN expenses_withdrawals.receiver_name IS 'اسم مستلم المبلغ';
COMMENT ON COLUMN expenses_withdrawals.sender_name IS 'اسم المسلم (المدير أو المسؤول)';