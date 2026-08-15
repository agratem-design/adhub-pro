-- إصلاح مشاكل الأمان: إضافة RLS policies المفقودة
-- إضافة policies للجداول التي تحتاجها

-- إضافة RLS policy لجدول customer_financials
CREATE POLICY "Enable read access for all users" ON customer_financials
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON customer_financials  
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON customer_financials
  FOR UPDATE USING (true);

-- إضافة RLS policy لجدول installation_print_pricing إذا كان موجود
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installation_print_pricing') THEN
        EXECUTE 'CREATE POLICY IF NOT EXISTS "Enable read access for all users" ON installation_print_pricing FOR SELECT USING (true)';
        EXECUTE 'CREATE POLICY IF NOT EXISTS "Enable insert for all users" ON installation_print_pricing FOR INSERT WITH CHECK (true)';
        EXECUTE 'CREATE POLICY IF NOT EXISTS "Enable update for all users" ON installation_print_pricing FOR UPDATE USING (true)';
    END IF;
END $$;

-- إضافة foreign key constraints الآن
ALTER TABLE "Contract" 
ADD CONSTRAINT IF NOT EXISTS fk_contract_customer 
FOREIGN KEY (customer_id) REFERENCES customers(id);

ALTER TABLE "Contract" 
ADD CONSTRAINT IF NOT EXISTS fk_contract_billboard 
FOREIGN KEY (billboard_id) REFERENCES billboards(ID);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_billboard_id ON "Contract"(billboard_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_financials_customer_id ON customer_financials(customer_id);