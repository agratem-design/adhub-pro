UPDATE contract_terms 
SET term_content = 'يتم السداد وفقاً للدفعات المتفق عليها:
{payments}

وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.'
WHERE term_key = 'term_5';