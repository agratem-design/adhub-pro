-- حذف التكرارات من السلف (الاحتفاظ بالأقدم)
DELETE FROM employee_advances a
USING employee_advances b
WHERE a.distributed_payment_id = b.distributed_payment_id 
  AND a.distributed_payment_id IS NOT NULL
  AND a.created_at > b.created_at;

-- إنشاء unique index لمنع تكرار السلف لنفس الدفعة الموزعة
DROP INDEX IF EXISTS unique_advance_per_distributed_payment;
CREATE UNIQUE INDEX unique_advance_per_distributed_payment 
ON employee_advances (distributed_payment_id) 
WHERE distributed_payment_id IS NOT NULL;

-- إنشاء trigger لحذف السلف عند حذف الدفعة الموزعة
CREATE OR REPLACE FUNCTION delete_advance_on_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.distributed_payment_id IS NOT NULL THEN
    DELETE FROM employee_advances 
    WHERE distributed_payment_id = OLD.distributed_payment_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delete_advance_on_payment_delete ON customer_payments;

CREATE TRIGGER trg_delete_advance_on_payment_delete
BEFORE DELETE ON customer_payments
FOR EACH ROW
EXECUTE FUNCTION delete_advance_on_payment_delete();

-- إنشاء trigger لحذف السحوبات عند حذف الدفعة الموزعة
CREATE OR REPLACE FUNCTION delete_withdrawal_on_payment_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.distributed_payment_id IS NOT NULL THEN
    DELETE FROM expenses_withdrawals 
    WHERE distributed_payment_id = OLD.distributed_payment_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_delete_withdrawal_on_payment_delete ON customer_payments;

CREATE TRIGGER trg_delete_withdrawal_on_payment_delete
BEFORE DELETE ON customer_payments
FOR EACH ROW
EXECUTE FUNCTION delete_withdrawal_on_payment_delete();