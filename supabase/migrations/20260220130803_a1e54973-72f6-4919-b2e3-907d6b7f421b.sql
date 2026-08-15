
-- إضافة عمود عدد الأوجه لبنود مهمة الطباعة
ALTER TABLE public.print_task_items ADD COLUMN IF NOT EXISTS faces_count integer DEFAULT 1;

-- إضافة عمود عدد الأوجه لبنود مهمة القص
ALTER TABLE public.cutout_task_items ADD COLUMN IF NOT EXISTS faces_count integer DEFAULT 1;

COMMENT ON COLUMN public.print_task_items.faces_count IS 'عدد أوجه اللوحة المطلوب طباعتها';
COMMENT ON COLUMN public.cutout_task_items.faces_count IS 'عدد أوجه اللوحة المطلوب قصها';
