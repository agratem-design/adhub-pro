-- ✅ إضافة عمود invoice_id إلى print_tasks إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'print_tasks' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE print_tasks ADD COLUMN invoice_id UUID REFERENCES printed_invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ✅ إضافة عمود invoice_id إلى cutout_tasks إذا لم يكن موجوداً
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cutout_tasks' AND column_name = 'invoice_id'
  ) THEN
    ALTER TABLE cutout_tasks ADD COLUMN invoice_id UUID REFERENCES printed_invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ✅ إنشاء trigger لحذف الدفعات عند حذف الفاتورة
CREATE OR REPLACE FUNCTION delete_invoice_payments()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM customer_payments 
  WHERE printed_invoice_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_invoice_payments ON printed_invoices;
CREATE TRIGGER trigger_delete_invoice_payments
BEFORE DELETE ON printed_invoices
FOR EACH ROW
EXECUTE FUNCTION delete_invoice_payments();

-- ✅ إنشاء trigger لحذف الفاتورة عند حذف مهمة الطباعة
CREATE OR REPLACE FUNCTION delete_print_task_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.invoice_id IS NOT NULL THEN
    DELETE FROM printed_invoices WHERE id = OLD.invoice_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_print_task_invoice ON print_tasks;
CREATE TRIGGER trigger_delete_print_task_invoice
BEFORE DELETE ON print_tasks
FOR EACH ROW
EXECUTE FUNCTION delete_print_task_invoice();

-- ✅ إنشاء trigger لحذف الفاتورة عند حذف مهمة المجسمات
CREATE OR REPLACE FUNCTION delete_cutout_task_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.invoice_id IS NOT NULL THEN
    DELETE FROM printed_invoices WHERE id = OLD.invoice_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_cutout_task_invoice ON cutout_tasks;
CREATE TRIGGER trigger_delete_cutout_task_invoice
BEFORE DELETE ON cutout_tasks
FOR EACH ROW
EXECUTE FUNCTION delete_cutout_task_invoice();