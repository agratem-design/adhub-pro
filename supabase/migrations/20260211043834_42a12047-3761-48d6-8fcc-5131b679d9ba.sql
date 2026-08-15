-- تنظيف الأحرف غير المرئية من بيانات العميل
UPDATE customers 
SET 
  company = REGEXP_REPLACE(company, E'[\\x200E\\x200F\\x200B\\x00AD\\xFEFF]', '', 'g'),
  phone = REGEXP_REPLACE(phone, E'[\\x200E\\x200F\\x200B\\x00AD\\xFEFF]', '', 'g')
WHERE id = '3b87087c-17a1-42dd-9897-3731b20f680c';

-- تنظيف العقود المرتبطة أيضاً
UPDATE "Contract"
SET 
  "Company" = REGEXP_REPLACE("Company", E'[\\x200E\\x200F\\x200B\\x00AD\\xFEFF]', '', 'g'),
  "Phone" = REGEXP_REPLACE("Phone", E'[\\x200E\\x200F\\x200B\\x00AD\\xFEFF]', '', 'g')
WHERE customer_id = '3b87087c-17a1-42dd-9897-3731b20f680c';