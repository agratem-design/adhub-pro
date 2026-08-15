-- حذف الـ trigger القديم الذي ينشئ حركات مكررة
DROP TRIGGER IF EXISTS trigger_update_custody_on_expense ON custody_expenses;
DROP TRIGGER IF EXISTS custody_expense_trigger ON custody_expenses;

-- حذف الدالة القديمة
DROP FUNCTION IF EXISTS update_custody_on_expense() CASCADE;

-- إنشاء دالة جديدة لتحديث رصيد العهدة فقط دون إنشاء حركة
CREATE OR REPLACE FUNCTION public.update_custody_balance_on_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- تحديث الرصيد فقط دون إنشاء حركة في جدول custody_transactions
    UPDATE custody_accounts 
    SET current_balance = current_balance - NEW.amount,
        updated_at = now()
    WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- تحديث الرصيد عند تعديل المصروف
    UPDATE custody_accounts 
    SET current_balance = current_balance + OLD.amount - NEW.amount,
        updated_at = now()
    WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- إرجاع الرصيد عند حذف المصروف
    UPDATE custody_accounts 
    SET current_balance = current_balance + OLD.amount,
        updated_at = now()
    WHERE id = OLD.custody_account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- إنشاء trigger جديد يحدث الرصيد فقط
CREATE TRIGGER custody_expense_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON custody_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_custody_balance_on_expense();

-- حذف الحركات المكررة التي تم إنشاؤها من المصروفات
DELETE FROM custody_transactions 
WHERE transaction_type = 'expense';