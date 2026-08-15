-- إصلاح دالة تحديث رصيد العهدة - البحث فقط بـ source_payment_id
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
      -- ابحث عن العهدة المرتبطة بهذه الدفعة عبر source_payment_id فقط
      SELECT * INTO v_custody_account
      FROM custody_accounts
      WHERE source_payment_id = NEW.distributed_payment_id;
      
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