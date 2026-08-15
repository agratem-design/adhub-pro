-- إضافة فهارس لتحسين أداء قاعدة البيانات

-- فهرس على customer_payments للبحث حسب contract_number
CREATE INDEX IF NOT EXISTS idx_customer_payments_contract 
ON customer_payments(contract_number);

-- فهرس على customer_payments للبحث حسب paid_at
CREATE INDEX IF NOT EXISTS idx_customer_payments_paid_at 
ON customer_payments(paid_at DESC);

-- فهرس مركب للبحث المتكرر
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_contract 
ON customer_payments(customer_id, contract_number);

-- فهرس على sizes للبحث بالاسم (يستخدم كثيراً)
CREATE INDEX IF NOT EXISTS idx_sizes_name_lower 
ON sizes(LOWER(name));

-- فهرس على printers
CREATE INDEX IF NOT EXISTS idx_printers_name 
ON printers(name);

-- فهرس على installation_print_pricing
CREATE INDEX IF NOT EXISTS idx_installation_print_pricing_size 
ON installation_print_pricing(size);

-- تحليل الجداول المتأثرة
ANALYZE customer_payments;
ANALYZE sizes;
ANALYZE printers;
ANALYZE installation_print_pricing;
ANALYZE billboards;
ANALYZE "Contract";