-- إصلاح مشكلة trigger الذي يحاول إنشاء print_task مرتين

-- حذف الـ trigger القديم
DROP TRIGGER IF EXISTS trigger_create_print_task ON printed_invoices;
DROP FUNCTION IF EXISTS create_print_task_for_invoice();

-- إنشاء trigger جديد يتحقق قبل إنشاء print_task
CREATE OR REPLACE FUNCTION create_print_task_for_invoice_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_task_exists boolean;
BEGIN
  -- التحقق إذا كانت مهمة طباعة موجودة بالفعل لهذه الفاتورة
  SELECT EXISTS(
    SELECT 1 FROM print_tasks WHERE invoice_id = NEW.id
  ) INTO v_task_exists;
  
  -- إذا كانت موجودة، لا نفعل شيء (المهمة تم إنشاؤها يدوياً)
  IF v_task_exists THEN
    RETURN NEW;
  END IF;
  
  -- إذا كانت الفاتورة من نوع طباعة يدوية (PTM) لا نفعل شيء
  IF NEW.invoice_number LIKE 'PTM-%' THEN
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ربط الـ trigger الجديد (لكن لن يفعل شيء للفواتير اليدوية)
CREATE TRIGGER trigger_create_print_task_v2
AFTER INSERT ON printed_invoices
FOR EACH ROW
EXECUTE FUNCTION create_print_task_for_invoice_v2();