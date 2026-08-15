-- تنظيف شامل للأحرف غير المرئية والمسافات الزائدة
UPDATE customers 
SET 
  company = TRIM(REGEXP_REPLACE(company, E'[\\u200E\\u200F\\u200B\\u00AD\\uFEFF\\u200C\\u200D\\u2069\\u2068\\u2067\\u2066\\u202C\\u202B\\u202A\\u061C]', '', 'g')),
  phone = TRIM(REGEXP_REPLACE(phone, E'[\\u200E\\u200F\\u200B\\u00AD\\uFEFF\\u200C\\u200D\\u2069\\u2068\\u2067\\u2066\\u202C\\u202B\\u202A\\u061C]', '', 'g'))
WHERE id = '3b87087c-17a1-42dd-9897-3731b20f680c';

UPDATE "Contract"
SET 
  "Company" = TRIM(REGEXP_REPLACE("Company", E'[\\u200E\\u200F\\u200B\\u00AD\\uFEFF\\u200C\\u200D\\u2069\\u2068\\u2067\\u2066\\u202C\\u202B\\u202A\\u061C]', '', 'g')),
  "Phone" = TRIM(REGEXP_REPLACE("Phone", E'[\\u200E\\u200F\\u200B\\u00AD\\uFEFF\\u200C\\u200D\\u2069\\u2068\\u2067\\u2066\\u202C\\u202B\\u202A\\u061C]', '', 'g'))
WHERE customer_id = '3b87087c-17a1-42dd-9897-3731b20f680c';