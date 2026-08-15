-- إضافة حقل used_as_payment لجدول إيجارات اللوحات الصديقة
ALTER TABLE public.friend_billboard_rentals 
ADD COLUMN IF NOT EXISTS used_as_payment numeric DEFAULT 0;

-- إضافة حقل selectable_for_payment للتحكم في ظهور الإيجار ككشف مستقل
ALTER TABLE public.friend_billboard_rentals 
ADD COLUMN IF NOT EXISTS selectable_for_payment boolean DEFAULT true;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.friend_billboard_rentals.used_as_payment IS 'المبلغ المستخدم من هذا الإيجار كدفعة موزعة لسداد ديون العميل';
COMMENT ON COLUMN public.friend_billboard_rentals.selectable_for_payment IS 'هل يظهر هذا الإيجار في قائمة الدفعات المتاحة للسداد';