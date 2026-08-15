-- تصحيح قيم العهدة للعقد 1176
-- المبلغ الأساسي: 11500
-- المصروف: 1500
-- المتبقي: 10000
UPDATE custody_accounts 
SET 
  initial_amount = 11500,
  current_balance = 10000,
  updated_at = now()
WHERE id = '1a1995e7-e9be-4f64-bb10-91fe1d719337';