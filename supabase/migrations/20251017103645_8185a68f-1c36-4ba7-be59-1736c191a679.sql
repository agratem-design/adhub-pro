-- إضافة عمود حالة الدفع للعقد
ALTER TABLE "Contract" 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid'));

-- إضافة عمود تاريخ آخر دفعة في جدول العملاء
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS last_payment_date date;

-- تحديث تاريخ آخر دفعة للعملاء الحاليين
UPDATE customers c
SET last_payment_date = (
  SELECT MAX(paid_at) 
  FROM customer_payments 
  WHERE customer_id = c.id
);

-- دالة لتحديث حالة دفع العقد تلقائياً
CREATE OR REPLACE FUNCTION update_contract_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Contract" c
  SET payment_status = CASE
    WHEN COALESCE(c."Total Paid", '0')::numeric >= COALESCE(c."Total", 0) THEN 'paid'
    WHEN COALESCE(c."Total Paid", '0')::numeric > 0 THEN 'partial'
    ELSE 'unpaid'
  END
  WHERE c."Contract_Number" = NEW.contract_number;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لتحديث حالة العقد عند إضافة دفعة
DROP TRIGGER IF EXISTS trigger_update_contract_payment_status ON customer_payments;
CREATE TRIGGER trigger_update_contract_payment_status
AFTER INSERT OR UPDATE ON customer_payments
FOR EACH ROW
EXECUTE FUNCTION update_contract_payment_status();

-- دالة لتحديث تاريخ آخر دفعة للعميل
CREATE OR REPLACE FUNCTION update_customer_last_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE customers
  SET last_payment_date = (
    SELECT MAX(paid_at)
    FROM customer_payments
    WHERE customer_id = NEW.customer_id
  )
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger لتحديث تاريخ آخر دفعة
DROP TRIGGER IF EXISTS trigger_update_customer_last_payment ON customer_payments;
CREATE TRIGGER trigger_update_customer_last_payment
AFTER INSERT OR UPDATE ON customer_payments
FOR EACH ROW
EXECUTE FUNCTION update_customer_last_payment();