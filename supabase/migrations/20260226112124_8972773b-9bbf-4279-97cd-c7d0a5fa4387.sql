
-- إضافة عمود توزيع التكاليف في composite_tasks
-- يخزن بيانات التوزيع بصيغة JSON لكل خدمة (طباعة، مجسمات، تركيب)
-- مثال: {"print": {"customer_pct": 50, "company_pct": 30, "printer_pct": 20, "reason": "خطأ طباعة"}, ...}
ALTER TABLE public.composite_tasks 
ADD COLUMN IF NOT EXISTS cost_allocation jsonb DEFAULT NULL;

-- إضافة تخفيض لكل خدمة منفصلة
ALTER TABLE public.composite_tasks 
ADD COLUMN IF NOT EXISTS print_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS print_discount_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cutout_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS cutout_discount_reason text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS installation_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS installation_discount_reason text DEFAULT NULL;

-- إضافة حقول التوزيع في printed_invoices أيضاً لحفظ بيانات التوزيع مع الفاتورة
ALTER TABLE public.printed_invoices 
ADD COLUMN IF NOT EXISTS cost_allocation jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discount_reason text DEFAULT NULL;
