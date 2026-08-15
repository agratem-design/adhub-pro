-- إنشاء جدول المطابع
CREATE TABLE IF NOT EXISTS public.printers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- تمكين RLS
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Allow all operations on printers"
  ON public.printers
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- إضافة عمود printer_id لفواتير الطباعة
ALTER TABLE public.printed_invoices 
ADD COLUMN IF NOT EXISTS printer_id UUID REFERENCES public.printers(id);

-- إضافة حقول للـ checkbox في فواتير المبيعات والمشتريات
ALTER TABLE public.sales_invoices 
ADD COLUMN IF NOT EXISTS selectable_for_payment BOOLEAN DEFAULT true;

ALTER TABLE public.purchase_invoices 
ADD COLUMN IF NOT EXISTS selectable_for_payment BOOLEAN DEFAULT true;

-- تحديث timestamp عند التعديل
CREATE OR REPLACE FUNCTION public.update_printers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_printers_updated_at
  BEFORE UPDATE ON public.printers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_printers_updated_at();