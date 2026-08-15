
-- حذف سجلات الدفع اليتيمة لفواتير المشتريات المحذوفة
DELETE FROM customer_payments 
WHERE entry_type = 'purchase_invoice' 
  AND notes LIKE 'فاتورة مشتريات%'
  AND NOT EXISTS (
    SELECT 1 FROM purchase_invoices pi 
    WHERE customer_payments.notes LIKE '%' || pi.invoice_number || '%'
  );

-- إنشاء دالة لحذف سجلات الدفع عند حذف فاتورة المشتريات
CREATE OR REPLACE FUNCTION public.delete_purchase_invoice_payments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- حذف سجلات الدفع المرتبطة بفاتورة المشتريات
  DELETE FROM customer_payments 
  WHERE entry_type = 'purchase_invoice' 
    AND notes LIKE '%' || OLD.invoice_number || '%';
  
  -- حذف دفعات سداد الفاتورة أيضاً
  DELETE FROM customer_payments 
  WHERE purchase_invoice_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- إنشاء trigger لحذف سجلات الدفع تلقائياً عند حذف فاتورة المشتريات
DROP TRIGGER IF EXISTS trigger_delete_purchase_invoice_payments ON purchase_invoices;
CREATE TRIGGER trigger_delete_purchase_invoice_payments
  BEFORE DELETE ON purchase_invoices
  FOR EACH ROW
  EXECUTE FUNCTION delete_purchase_invoice_payments();
