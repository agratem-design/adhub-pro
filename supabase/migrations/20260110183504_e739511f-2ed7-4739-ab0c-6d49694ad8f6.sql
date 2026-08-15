-- تحديث البند الخامس لإضافة متغير شامل/غير شامل الطباعة والتركيب
UPDATE contract_terms 
SET term_content = 'إجمالي تكلفة الإيجار لعدد  .({billboardsCount}) لوحة إعلانية هو  ({totalAmount})  {currency} {discount}. {inclusionText}. يتم السداد وفقاً للدفعات المتفق عليها: {payments}. وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.',
    updated_at = NOW()
WHERE term_key = 'term_5';