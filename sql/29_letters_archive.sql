-- إضافة عمود وتاريخ الأرشفة لجدول المراسلات والتقارير
-- أرشفة المراسلة بدل حذفها نهائياً مع إمكانية استرجاعها

ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;

-- فهرس لتسريع استعلامات المراسلات النشطة والمؤرشفة
CREATE INDEX IF NOT EXISTS idx_letters_archived_at ON public.letters(archived_at);

COMMENT ON COLUMN public.letters.archived_at IS 'تاريخ ووقت أرشفة المراسلة أو التقرير، وتكون NULL إذا كانت المراسلة نشطة وغير مؤرشفة';
