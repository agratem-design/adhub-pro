-- إصلاح مشكلة foreign key constraint عند الحذف
-- حذف القيد القديم وإنشاء واحد جديد مع CASCADE

-- 1. حذف القيد القديم من print_tasks
ALTER TABLE print_tasks 
DROP CONSTRAINT IF EXISTS print_tasks_invoice_id_fkey;

-- 2. إضافة القيد الجديد مع ON DELETE SET NULL
ALTER TABLE print_tasks
ADD CONSTRAINT print_tasks_invoice_id_fkey 
FOREIGN KEY (invoice_id) 
REFERENCES printed_invoices(id) 
ON DELETE SET NULL;

-- 3. نفس الشيء مع cutout_tasks
ALTER TABLE cutout_tasks 
DROP CONSTRAINT IF EXISTS cutout_tasks_invoice_id_fkey;

ALTER TABLE cutout_tasks
ADD CONSTRAINT cutout_tasks_invoice_id_fkey 
FOREIGN KEY (invoice_id) 
REFERENCES printed_invoices(id) 
ON DELETE SET NULL;

-- 4. وأيضاً composite_tasks
ALTER TABLE composite_tasks 
DROP CONSTRAINT IF EXISTS composite_tasks_combined_invoice_id_fkey;

ALTER TABLE composite_tasks
ADD CONSTRAINT composite_tasks_combined_invoice_id_fkey 
FOREIGN KEY (combined_invoice_id) 
REFERENCES printed_invoices(id) 
ON DELETE SET NULL;

-- Comment للتوضيح
COMMENT ON CONSTRAINT print_tasks_invoice_id_fkey ON print_tasks IS 
'عند حذف الفاتورة، يتم تعيين invoice_id إلى NULL في مهام الطباعة المرتبطة';

COMMENT ON CONSTRAINT cutout_tasks_invoice_id_fkey ON cutout_tasks IS 
'عند حذف الفاتورة، يتم تعيين invoice_id إلى NULL في مهام القص المرتبطة';

COMMENT ON CONSTRAINT composite_tasks_combined_invoice_id_fkey ON composite_tasks IS 
'عند حذف الفاتورة، يتم تعيين combined_invoice_id إلى NULL في المهام المجمعة المرتبطة';