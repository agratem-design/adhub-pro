UPDATE contract_terms 
SET term_content = 'إجمالي تكلفة الإيجار لعدد ({billboardsCount}) لوحة إعلانية هو ({totalAmount}) {currency}.
يتم السداد وفقاً للدفعات المتفق عليها:
{payments}

وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.'
WHERE term_key = 'term_5';