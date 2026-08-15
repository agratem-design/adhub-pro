-- إضافة الأعمدة المالية المهمة لجدول billboard_history
ALTER TABLE public.billboard_history
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS billboard_rent_price numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_before_discount numeric DEFAULT 0;

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_billboard_history_installation_date 
ON public.billboard_history(installation_date DESC);

-- ===== Trigger للتراجع عن التركيب (حذف السجل من التاريخ) =====

-- دالة لحذف السجل من billboard_history عند التراجع عن التركيب
CREATE OR REPLACE FUNCTION public.handle_installation_revert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- إذا تم تغيير الحالة من completed إلى pending أو تم حذف السجل
  IF (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status = 'pending') THEN
    -- حذف السجل من billboard_history
    DELETE FROM public.billboard_history
    WHERE billboard_id = NEW.billboard_id
      AND installation_date = OLD.installation_date
      AND created_at >= OLD.completed_at - INTERVAL '5 minutes'
      AND created_at <= OLD.completed_at + INTERVAL '5 minutes';
    
    RAISE NOTICE 'Deleted history record for billboard % due to installation revert', NEW.billboard_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger على جدول installation_task_items
DROP TRIGGER IF EXISTS trigger_installation_revert ON public.installation_task_items;

CREATE TRIGGER trigger_installation_revert
AFTER UPDATE ON public.installation_task_items
FOR EACH ROW
WHEN (OLD.status = 'completed' AND NEW.status = 'pending')
EXECUTE FUNCTION public.handle_installation_revert();

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN public.billboard_history.discount_amount IS 'مبلغ التخفيض من العقد';
COMMENT ON COLUMN public.billboard_history.discount_percentage IS 'نسبة التخفيض من العقد';
COMMENT ON COLUMN public.billboard_history.installation_cost IS 'تكلفة التركيب من العقد';
COMMENT ON COLUMN public.billboard_history.billboard_rent_price IS 'سعر إيجار اللوحة من العقد';
COMMENT ON COLUMN public.billboard_history.total_before_discount IS 'المبلغ الكلي قبل التخفيض';

COMMENT ON FUNCTION public.handle_installation_revert() IS 'دالة لحذف السجل من billboard_history عند التراجع عن التركيب';
COMMENT ON TRIGGER trigger_installation_revert ON public.installation_task_items IS 'محفز يقوم بحذف السجل من التاريخ عند التراجع عن التركيب';