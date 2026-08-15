-- إضافة العلاقات المفقودة والحقول المطلوبة
-- إضافة حقل customer_id إلى جدول Contract إذا لم يكن موجوداً
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- إضافة حقل billboard_id إلى جدول Contract
ALTER TABLE "Contract" ADD COLUMN IF NOT EXISTS billboard_id BIGINT REFERENCES billboards(ID);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_contract_billboard_id ON "Contract"(billboard_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_financials_customer_id ON customer_financials(customer_id);

-- إنشاء دالة لتحديث customer_financials عند إضافة أو تعديل عقد
CREATE OR REPLACE FUNCTION update_customer_financials()
RETURNS TRIGGER AS $$
BEGIN
    -- في حالة إضافة عقد جديد
    IF TG_OP = 'INSERT' THEN
        INSERT INTO customer_financials (customer_id, name, total_contracts_amount, contracts_count, total_paid, total_remaining)
        VALUES (
            NEW.customer_id,
            (SELECT name FROM customers WHERE id = NEW.customer_id),
            COALESCE(NEW."Total Rent", 0),
            1,
            0,
            COALESCE(NEW."Total Rent", 0)
        )
        ON CONFLICT (customer_id) DO UPDATE SET
            total_contracts_amount = customer_financials.total_contracts_amount + COALESCE(NEW."Total Rent", 0),
            contracts_count = customer_financials.contracts_count + 1,
            total_remaining = customer_financials.total_remaining + COALESCE(NEW."Total Rent", 0);
            
        -- تحديث حالة اللوحة إلى غير متاحة
        UPDATE billboards 
        SET Status = 'rented',
            Customer_Name = (SELECT name FROM customers WHERE id = NEW.customer_id),
            Contract_Number = NEW.Contract_Number,
            Rent_Start_Date = NEW."Contract Date",
            Rent_End_Date = NEW."End Date"
        WHERE ID = NEW.billboard_id;
        
        RETURN NEW;
    END IF;
    
    -- في حالة تعديل عقد موجود
    IF TG_OP = 'UPDATE' THEN
        -- إذا تم تغيير customer_id
        IF OLD.customer_id != NEW.customer_id THEN
            -- تحديث العميل السابق
            UPDATE customer_financials 
            SET total_contracts_amount = total_contracts_amount - COALESCE(OLD."Total Rent", 0),
                contracts_count = contracts_count - 1,
                total_remaining = total_remaining - COALESCE(OLD."Total Rent", 0)
            WHERE customer_id = OLD.customer_id;
            
            -- إضافة للعميل الجديد
            INSERT INTO customer_financials (customer_id, name, total_contracts_amount, contracts_count, total_paid, total_remaining)
            VALUES (
                NEW.customer_id,
                (SELECT name FROM customers WHERE id = NEW.customer_id),
                COALESCE(NEW."Total Rent", 0),
                1,
                0,
                COALESCE(NEW."Total Rent", 0)
            )
            ON CONFLICT (customer_id) DO UPDATE SET
                total_contracts_amount = customer_financials.total_contracts_amount + COALESCE(NEW."Total Rent", 0),
                contracts_count = customer_financials.contracts_count + 1,
                total_remaining = customer_financials.total_remaining + COALESCE(NEW."Total Rent", 0);
        ELSE
            -- تعديل المبلغ فقط
            UPDATE customer_financials 
            SET total_contracts_amount = total_contracts_amount - COALESCE(OLD."Total Rent", 0) + COALESCE(NEW."Total Rent", 0),
                total_remaining = total_remaining - COALESCE(OLD."Total Rent", 0) + COALESCE(NEW."Total Rent", 0)
            WHERE customer_id = NEW.customer_id;
        END IF;
        
        -- تحديث بيانات اللوحة
        UPDATE billboards 
        SET Customer_Name = (SELECT name FROM customers WHERE id = NEW.customer_id),
            Contract_Number = NEW.Contract_Number,
            Rent_Start_Date = NEW."Contract Date",
            Rent_End_Date = NEW."End Date"
        WHERE ID = NEW.billboard_id;
        
        RETURN NEW;
    END IF;
    
    -- في حالة حذف عقد
    IF TG_OP = 'DELETE' THEN
        -- تحديث customer_financials
        UPDATE customer_financials 
        SET total_contracts_amount = total_contracts_amount - COALESCE(OLD."Total Rent", 0),
            contracts_count = contracts_count - 1,
            total_remaining = total_remaining - COALESCE(OLD."Total Rent", 0)
        WHERE customer_id = OLD.customer_id;
        
        -- تحديث حالة اللوحة لتصبح متاحة
        UPDATE billboards 
        SET Status = 'available',
            Customer_Name = NULL,
            Contract_Number = NULL,
            Rent_Start_Date = NULL,
            Rent_End_Date = NULL
        WHERE ID = OLD.billboard_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتطبيق الدالة على جدول Contract
DROP TRIGGER IF EXISTS trigger_update_customer_financials ON "Contract";
CREATE TRIGGER trigger_update_customer_financials
    AFTER INSERT OR UPDATE OR DELETE ON "Contract"
    FOR EACH ROW EXECUTE FUNCTION update_customer_financials();

-- إنشاء دالة لتحديث customer_financials عند إضافة أو تعديل دفعة
CREATE OR REPLACE FUNCTION update_financials_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- في حالة إضافة دفعة جديدة
    IF TG_OP = 'INSERT' THEN
        UPDATE customer_financials 
        SET total_paid = total_paid + NEW.amount,
            total_remaining = total_remaining - NEW.amount
        WHERE customer_id = NEW.customer_id;
        
        RETURN NEW;
    END IF;
    
    -- في حالة تعديل دفعة موجودة
    IF TG_OP = 'UPDATE' THEN
        -- إذا تم تغيير العميل
        IF OLD.customer_id != NEW.customer_id THEN
            -- إزالة من العميل السابق
            UPDATE customer_financials 
            SET total_paid = total_paid - OLD.amount,
                total_remaining = total_remaining + OLD.amount
            WHERE customer_id = OLD.customer_id;
            
            -- إضافة للعميل الجديد
            UPDATE customer_financials 
            SET total_paid = total_paid + NEW.amount,
                total_remaining = total_remaining - NEW.amount
            WHERE customer_id = NEW.customer_id;
        ELSE
            -- تعديل المبلغ فقط
            UPDATE customer_financials 
            SET total_paid = total_paid - OLD.amount + NEW.amount,
                total_remaining = total_remaining + OLD.amount - NEW.amount
            WHERE customer_id = NEW.customer_id;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- في حالة حذف دفعة
    IF TG_OP = 'DELETE' THEN
        UPDATE customer_financials 
        SET total_paid = total_paid - OLD.amount,
            total_remaining = total_remaining + OLD.amount
        WHERE customer_id = OLD.customer_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لتطبيق الدالة على جدول customer_payments
DROP TRIGGER IF EXISTS trigger_update_financials_on_payment ON customer_payments;
CREATE TRIGGER trigger_update_financials_on_payment
    AFTER INSERT OR UPDATE OR DELETE ON customer_payments
    FOR EACH ROW EXECUTE FUNCTION update_financials_on_payment();

-- إنشاء view لعرض العقود مع بيانات العملاء واللوحات
CREATE OR REPLACE VIEW contracts_with_details AS
SELECT 
    c.Contract_Number,
    c."Customer Name",
    c."Contract Date",
    c."End Date",
    c."Ad Type",
    c."Total Rent",
    c."Installation Cost",
    c.Total,
    c."Payment 1",
    c."Payment 2", 
    c."Payment 3",
    c."Total Paid",
    c.Remaining,
    c."Print Status",
    c.customer_id,
    c.billboard_id,
    cust.name as customer_name_normalized,
    cust.company,
    cust.phone,
    cust.email,
    bb.Billboard_Name,
    bb.Size,
    bb.City,
    bb.District,
    bb.Level,
    bb.Status as billboard_status,
    bb.GPS_Coordinates,
    bb.Image_URL
FROM "Contract" c
LEFT JOIN customers cust ON c.customer_id = cust.id
LEFT JOIN billboards bb ON c.billboard_id = bb.ID;

-- إنشاء view لكشف حساب العملاء
CREATE OR REPLACE VIEW customer_account_statement AS
SELECT 
    c.id as customer_id,
    c.name,
    c.company,
    c.phone,
    cf.total_contracts_amount,
    cf.contracts_count,
    cf.total_paid,
    cf.total_remaining,
    CASE 
        WHEN cf.total_remaining > 0 THEN 'له رصيد'
        WHEN cf.total_remaining < 0 THEN 'عليه دين'
        ELSE 'متوازن'
    END as account_status
FROM customers c
LEFT JOIN customer_financials cf ON c.id = cf.customer_id;

-- دالة لجلب عقود عميل محدد
CREATE OR REPLACE FUNCTION get_customer_contracts(customer_uuid UUID)
RETURNS TABLE (
    contract_number BIGINT,
    customer_name TEXT,
    contract_date DATE,
    end_date DATE,
    ad_type TEXT,
    total_rent NUMERIC,
    billboard_name TEXT,
    billboard_size TEXT,
    city TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.Contract_Number::BIGINT,
        c."Customer Name"::TEXT,
        c."Contract Date"::DATE,
        c."End Date"::DATE,
        c."Ad Type"::TEXT,
        c."Total Rent"::NUMERIC,
        bb.Billboard_Name::TEXT,
        bb.Size::TEXT,
        bb.City::TEXT,
        c."Print Status"::TEXT
    FROM "Contract" c
    LEFT JOIN billboards bb ON c.billboard_id = bb.ID
    WHERE c.customer_id = customer_uuid
    ORDER BY c."Contract Date" DESC;
END;
$$ LANGUAGE plpgsql;

-- دالة لجلب كشف حساب عميل
CREATE OR REPLACE FUNCTION get_customer_financials(customer_uuid UUID)
RETURNS TABLE (
    customer_id UUID,
    customer_name TEXT,
    total_contracts_amount NUMERIC,
    contracts_count BIGINT,
    total_paid NUMERIC,
    total_remaining NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cf.customer_id,
        cf.name::TEXT,
        cf.total_contracts_amount,
        cf.contracts_count,
        cf.total_paid,
        cf.total_remaining
    FROM customer_financials cf
    WHERE cf.customer_id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- دالة لجلب جميع المدفوعات الخاصة بعميل
CREATE OR REPLACE FUNCTION get_customer_payments(customer_uuid UUID)
RETURNS TABLE (
    payment_id UUID,
    amount NUMERIC,
    paid_at DATE,
    method TEXT,
    contract_number BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cp.id,
        cp.amount,
        cp.paid_at,
        cp.method::TEXT,
        cp.contract_number,
        cp.notes::TEXT,
        cp.created_at
    FROM customer_payments cp
    WHERE cp.customer_id = customer_uuid
    ORDER BY cp.paid_at DESC, cp.created_at DESC;
END;
$$ LANGUAGE plpgsql;