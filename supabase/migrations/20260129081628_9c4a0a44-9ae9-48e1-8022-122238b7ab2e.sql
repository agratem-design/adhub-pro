-- دالة لتحديث رصيد العهدة عند تعديل الدفعة الموزعة
CREATE OR REPLACE FUNCTION public.sync_custody_balance_on_payment_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_custody_account RECORD;
  v_amount_difference NUMERIC;
BEGIN
  -- فقط عند التحديث
  IF TG_OP = 'UPDATE' THEN
    -- تحقق من أن الدفعة لها distributed_payment_id
    IF NEW.distributed_payment_id IS NOT NULL THEN
      -- ابحث عن العهدة المرتبطة بهذه الدفعة
      SELECT * INTO v_custody_account
      FROM custody_accounts
      WHERE source_payment_id = NEW.distributed_payment_id
        AND employee_id = NEW.customer_id; -- customer_id هنا يمثل employee_id في حالة العهد
      
      -- إذا لم نجد بـ customer_id، نبحث بطريقة أخرى
      IF v_custody_account IS NULL THEN
        SELECT * INTO v_custody_account
        FROM custody_accounts
        WHERE source_payment_id = NEW.distributed_payment_id;
      END IF;
      
      IF v_custody_account IS NOT NULL THEN
        -- احسب الفرق بين المبلغ الجديد والقديم
        v_amount_difference := COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0);
        
        -- إذا كان هناك فرق، حدث العهدة
        IF v_amount_difference != 0 THEN
          UPDATE custody_accounts
          SET 
            initial_amount = initial_amount + v_amount_difference,
            current_balance = current_balance + v_amount_difference,
            updated_at = now()
          WHERE id = v_custody_account.id;
          
          RAISE NOTICE 'تم تحديث عهدة % - الفرق: %', v_custody_account.id, v_amount_difference;
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- حذف الـ trigger القديم إن وجد
DROP TRIGGER IF EXISTS trigger_sync_custody_on_payment_update ON customer_payments;

-- إنشاء الـ trigger
CREATE TRIGGER trigger_sync_custody_on_payment_update
  AFTER UPDATE ON customer_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_custody_balance_on_payment_update();