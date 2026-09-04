-- Share the distribution lock so direct withdrawals cannot race a distributed payout.
CREATE OR REPLACE FUNCTION public.guard_operating_withdrawal()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE increase numeric; available numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount<=0 OR NEW.amount::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'مبلغ السحب يجب أن يكون أكبر من صفر';
  END IF;
  increase := NEW.amount - CASE WHEN TG_OP='UPDATE' THEN OLD.amount ELSE 0 END;
  IF increase>0 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('payment-distribution',0));
    available := COALESCE(public.available_operating_balance(),0);
    IF increase>available THEN RAISE EXCEPTION 'السحب يتجاوز رصيد مستحقات التشغيل المتاح (%) د.ل',available; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_operating_withdrawal ON public.expenses_withdrawals;
CREATE TRIGGER guard_operating_withdrawal BEFORE INSERT OR UPDATE OF amount ON public.expenses_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_operating_withdrawal();

CREATE OR REPLACE FUNCTION public.guard_expense_amount_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE settled numeric;
BEGIN
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    SELECT COALESCE(sum(amount),0) INTO settled FROM expense_payments WHERE expense_id=NEW.id;
    IF NEW.amount IS NULL OR NEW.amount<=0 OR NEW.amount::text IN ('NaN','Infinity','-Infinity') OR NEW.amount<settled THEN
      RAISE EXCEPTION 'قيمة المصروف يجب أن تكون موجبة وألا تقل عن المبلغ المسدد (%) د.ل',settled;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_expense_amount_update ON public.expenses;
CREATE TRIGGER guard_expense_amount_update BEFORE UPDATE OF amount ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.guard_expense_amount_update();
