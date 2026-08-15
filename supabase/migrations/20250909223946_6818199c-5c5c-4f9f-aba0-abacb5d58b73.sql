-- إضافة الحقول المطلوبة بدون foreign keys أولاً
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS billboard_id BIGINT;

-- إنشاء فهارس
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_billboard_id ON "Contract"(billboard_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_financials_customer_id ON customer_financials(customer_id);

-- إنشاء الـ foreign keys بشكل منفصل
DO $$ 
BEGIN
    -- إضافة foreign key لـ customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_contract_customer' 
                   AND table_name = 'Contract') THEN
        ALTER TABLE "Contract" ADD CONSTRAINT fk_contract_customer 
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
    END IF;
    
    -- إضافة foreign key لـ billboards  
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_contract_billboard' 
                   AND table_name = 'Contract') THEN
        ALTER TABLE "Contract" ADD CONSTRAINT fk_contract_billboard 
        FOREIGN KEY (billboard_id) REFERENCES billboards("ID") ON DELETE SET NULL;
    END IF;
END $$;