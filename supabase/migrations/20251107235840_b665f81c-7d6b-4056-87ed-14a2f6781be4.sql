-- إضافة أعمدة الخطوط إلى جدول reports
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS font_family TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS font_weight TEXT DEFAULT '400';

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.reports.font_family IS 'نوع الخط المستخدم في التقرير';
COMMENT ON COLUMN public.reports.font_weight IS 'وزن/سمك الخط المستخدم في التقرير';