-- إصلاح مشاكل الأمان وإضافة العلاقات بطريقة صحيحة

-- إضافة RLS policies للجداول المفقودة
CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON customer_financials
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Enable insert for all users" ON customer_financials  
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Enable update for all users" ON customer_financials
  FOR UPDATE USING (true);

-- إضافة foreign key constraints بطريقة صحيحة
DO $$
BEGIN
    -- إضافة foreign key لـ customer_id إذا لم يكن موجود
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_contract_customer'
    ) THEN
        ALTER TABLE "Contract" 
        ADD CONSTRAINT fk_contract_customer 
        FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;

    -- إضافة foreign key لـ billboard_id إذا لم يكن موجود  
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_contract_billboard'
    ) THEN
        ALTER TABLE "Contract" 
        ADD CONSTRAINT fk_contract_billboard 
        FOREIGN KEY (billboard_id) REFERENCES billboards(ID);
    END IF;
END $$;

-- إنشاء الفهارس
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_billboard_id ON "Contract"(billboard_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_financials_customer_id ON customer_financials(customer_id);