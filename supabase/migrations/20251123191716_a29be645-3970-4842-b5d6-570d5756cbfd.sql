-- إضافة حقول جديدة لجدول print_tasks لدعم تكاليف المطبعة والزبون
ALTER TABLE print_tasks 
ADD COLUMN IF NOT EXISTS printer_total_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS printer_cost_per_meter NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_cost_per_meter NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS printer_cutout_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_cutout_cost NUMERIC DEFAULT 0;

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN print_tasks.printer_total_cost IS 'إجمالي التكلفة التي سندفعها للمطبعة';
COMMENT ON COLUMN print_tasks.printer_cost_per_meter IS 'سعر المتر الذي ندفعه للمطبعة';
COMMENT ON COLUMN print_tasks.customer_cost_per_meter IS 'سعر المتر الذي نحسبه للزبون';
COMMENT ON COLUMN print_tasks.printer_cutout_cost IS 'تكلفة القص للمطبعة';
COMMENT ON COLUMN print_tasks.customer_cutout_cost IS 'تكلفة القص للزبون';
COMMENT ON COLUMN print_tasks.customer_total_amount IS 'إجمالي المبلغ الذي سنحسبه للزبون';
COMMENT ON COLUMN print_tasks.total_cost IS 'تكلفة الطباعة للمطبعة (بدون القص)';

-- إضافة حقول جديدة لجدول print_task_items
ALTER TABLE print_task_items 
ADD COLUMN IF NOT EXISTS printer_unit_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_unit_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS printer_cutout_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_cutout_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutout_quantity INTEGER DEFAULT 0;

COMMENT ON COLUMN print_task_items.printer_unit_cost IS 'سعر الوحدة للمطبعة';
COMMENT ON COLUMN print_task_items.customer_unit_cost IS 'سعر الوحدة للزبون';
COMMENT ON COLUMN print_task_items.printer_cutout_cost IS 'تكلفة القص الواحد للمطبعة';
COMMENT ON COLUMN print_task_items.customer_cutout_cost IS 'تكلفة القص الواحد للزبون';
COMMENT ON COLUMN print_task_items.cutout_quantity IS 'عدد المجسمات في هذا البند';