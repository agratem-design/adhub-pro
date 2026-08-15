-- منع إنشاء فواتير منفصلة للمهام المجمعة
-- وحذف الفواتير المنفصلة عند إنشاء composite task

-- 1. دالة لحذف الفواتير المنفصلة للمهام المجمعة
CREATE OR REPLACE FUNCTION delete_separate_task_invoices()
RETURNS TRIGGER AS $$
BEGIN
  -- حذف فاتورة الطباعة إن وجدت
  IF NEW.print_task_id IS NOT NULL THEN
    DELETE FROM printed_invoices 
    WHERE id IN (
      SELECT invoice_id FROM print_tasks WHERE id = NEW.print_task_id
    );
    
    -- تحديث print_task لإزالة invoice_id
    UPDATE print_tasks 
    SET invoice_id = NULL 
    WHERE id = NEW.print_task_id;
  END IF;
  
  -- حذف فاتورة القص إن وجدت
  IF NEW.cutout_task_id IS NOT NULL THEN
    DELETE FROM printed_invoices 
    WHERE id IN (
      SELECT invoice_id FROM cutout_tasks WHERE id = NEW.cutout_task_id
    );
    
    -- تحديث cutout_task لإزالة invoice_id
    UPDATE cutout_tasks 
    SET invoice_id = NULL 
    WHERE id = NEW.cutout_task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء trigger لحذف الفواتير المنفصلة عند إنشاء composite task
DROP TRIGGER IF EXISTS delete_separate_invoices_on_composite_create ON composite_tasks;
CREATE TRIGGER delete_separate_invoices_on_composite_create
  AFTER INSERT ON composite_tasks
  FOR EACH ROW
  EXECUTE FUNCTION delete_separate_task_invoices();

-- 2. تحديث دالة mark_task_as_composite لمنع إنشاء فواتير جديدة
CREATE OR REPLACE FUNCTION mark_task_as_composite()
RETURNS TRIGGER AS $$
BEGIN
  -- تحديث print_task
  IF NEW.print_task_id IS NOT NULL THEN
    UPDATE print_tasks 
    SET is_composite = true 
    WHERE id = NEW.print_task_id;
  END IF;
  
  -- تحديث cutout_task
  IF NEW.cutout_task_id IS NOT NULL THEN
    UPDATE cutout_tasks 
    SET is_composite = true 
    WHERE id = NEW.cutout_task_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. حذف الفواتير المنفصلة المكررة الموجودة حالياً
-- هذا سيحذف الفواتير المنفصلة للمهام التي لها composite_task
DO $$
DECLARE
  composite_rec RECORD;
BEGIN
  FOR composite_rec IN 
    SELECT 
      ct.id as composite_id,
      ct.print_task_id,
      ct.cutout_task_id
    FROM composite_tasks ct
    WHERE ct.print_task_id IS NOT NULL OR ct.cutout_task_id IS NOT NULL
  LOOP
    -- حذف فاتورة الطباعة إن وجدت
    IF composite_rec.print_task_id IS NOT NULL THEN
      DELETE FROM printed_invoices 
      WHERE id IN (
        SELECT invoice_id FROM print_tasks 
        WHERE id = composite_rec.print_task_id 
        AND invoice_id IS NOT NULL
      );
      
      UPDATE print_tasks 
      SET invoice_id = NULL 
      WHERE id = composite_rec.print_task_id;
    END IF;
    
    -- حذف فاتورة القص إن وجدت
    IF composite_rec.cutout_task_id IS NOT NULL THEN
      DELETE FROM printed_invoices 
      WHERE id IN (
        SELECT invoice_id FROM cutout_tasks 
        WHERE id = composite_rec.cutout_task_id 
        AND invoice_id IS NOT NULL
      );
      
      UPDATE cutout_tasks 
      SET invoice_id = NULL 
      WHERE id = composite_rec.cutout_task_id;
    END IF;
  END LOOP;
END $$;