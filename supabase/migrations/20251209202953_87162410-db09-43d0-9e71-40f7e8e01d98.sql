-- حذف السجل الخاطئ الذي يظهر كفاتورة مشتريات وهو ليس كذلك
DELETE FROM customer_payments 
WHERE id = 'ee7387d7-e0df-4e13-8dd1-cf63f82beeb9'
AND entry_type = 'purchase_invoice'
AND amount = -26500;