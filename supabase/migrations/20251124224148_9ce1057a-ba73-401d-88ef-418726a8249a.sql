-- إصلاح مشكلة الحذف - حذف الـ trigger والدالة بالترتيب الصحيح

-- 1. حذف الـ triggers أولاً
DROP TRIGGER IF EXISTS trigger_delete_print_task_invoice ON print_tasks;
DROP TRIGGER IF EXISTS delete_invoice_payments ON printed_invoices;

-- 2. ثم حذف الدوال
DROP FUNCTION IF EXISTS delete_print_task_invoice() CASCADE;
DROP FUNCTION IF EXISTS delete_invoice_payments() CASCADE;

-- 3. إضافة trigger بسيط فقط لتنظيف البنود عند حذف المهمة
CREATE OR REPLACE FUNCTION cleanup_print_task_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- حذف البنود المرتبطة بالمهمة
  DELETE FROM print_task_items WHERE task_id = OLD.id;
  RETURN OLD;
END;
$$;

-- تطبيق الـ trigger
DROP TRIGGER IF EXISTS trigger_cleanup_print_task_items ON print_tasks;
CREATE TRIGGER trigger_cleanup_print_task_items
  BEFORE DELETE ON print_tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_print_task_items();

-- نفس الشيء لمهام القص
CREATE OR REPLACE FUNCTION cleanup_cutout_task_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM cutout_task_items WHERE task_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_cleanup_cutout_task_items ON cutout_tasks;
CREATE TRIGGER trigger_cleanup_cutout_task_items
  BEFORE DELETE ON cutout_tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_cutout_task_items();