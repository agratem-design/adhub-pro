-- =====================================================
-- 1. إنشاء جدول فواتير المشتريات
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 2. إنشاء جدول عناصر فواتير المشتريات
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 3. إنشاء جدول دفعات فواتير المشتريات
-- =====================================================
CREATE TABLE IF NOT EXISTS public.purchase_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'نقدي',
  payment_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 4. تحديث جدول فواتير الطباعة لمنع التعديل عند السداد
-- =====================================================
-- إضافة عمود لقفل الفاتورة عند السداد الكامل
ALTER TABLE public.printed_invoices 
ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;

-- =====================================================
-- 5. حذف قيد الـ CHECK على جدول customer_payments
-- =====================================================
ALTER TABLE public.customer_payments 
DROP CONSTRAINT IF EXISTS customer_payments_amount_check;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.customer_payments.amount IS 'يقبل قيم موجبة (دفعات) وسالبة (مشتريات من العميل)';

-- =====================================================
-- 6. تفعيل RLS على الجداول الجديدة
-- =====================================================
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. إنشاء سياسات RLS للجداول الجديدة
-- =====================================================
-- سياسات purchase_invoices
CREATE POLICY "Allow all operations on purchase_invoices" 
ON public.purchase_invoices FOR ALL 
USING (true) 
WITH CHECK (true);

-- سياسات purchase_invoice_items
CREATE POLICY "Allow all operations on purchase_invoice_items" 
ON public.purchase_invoice_items FOR ALL 
USING (true) 
WITH CHECK (true);

-- سياسات purchase_invoice_payments
CREATE POLICY "Allow all operations on purchase_invoice_payments" 
ON public.purchase_invoice_payments FOR ALL 
USING (true) 
WITH CHECK (true);

-- =====================================================
-- 8. إنشاء trigger لتحديث updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_purchase_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_purchase_invoices_updated_at
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_purchase_invoice_updated_at();

-- =====================================================
-- 9. إنشاء trigger لقفل الفاتورة عند السداد الكامل
-- =====================================================
CREATE OR REPLACE FUNCTION public.lock_paid_invoice()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paid = TRUE AND OLD.paid = FALSE THEN
    NEW.locked = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lock_paid_printed_invoice
BEFORE UPDATE ON public.printed_invoices
FOR EACH ROW
EXECUTE FUNCTION public.lock_paid_invoice();

CREATE TRIGGER lock_paid_purchase_invoice
BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW
EXECUTE FUNCTION public.lock_paid_invoice();

-- =====================================================
-- 10. إنشاء indexes لتحسين الأداء
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_customer_id ON public.purchase_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_invoice_date ON public.purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON public.purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_invoice_id ON public.purchase_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_payments_customer_id ON public.purchase_invoice_payments(customer_id);