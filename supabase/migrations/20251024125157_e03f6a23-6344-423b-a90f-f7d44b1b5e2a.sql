-- إنشاء جدول فواتير المبيعات
CREATE TABLE IF NOT EXISTS public.sales_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items JSONB NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT FALSE,
  locked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- إنشاء جدول دفعات فواتير المبيعات
CREATE TABLE IF NOT EXISTS public.sales_invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'نقدي',
  payment_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- إنشاء فهرس لرقم الفاتورة
CREATE INDEX IF NOT EXISTS idx_sales_invoices_invoice_number ON public.sales_invoices(invoice_number);

-- إنشاء فهرس لمعرف العميل
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON public.sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_payments_customer_id ON public.sales_invoice_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_payments_invoice_id ON public.sales_invoice_payments(invoice_id);

-- إضافة RLS policies
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on sales_invoices" ON public.sales_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on sales_invoice_payments" ON public.sales_invoice_payments FOR ALL USING (true) WITH CHECK (true);

-- إنشاء trigger لتحديث updated_at تلقائياً
CREATE TRIGGER update_sales_invoice_updated_at
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- إنشاء trigger لقفل الفاتورة عند السداد الكامل
CREATE TRIGGER lock_paid_sales_invoice
  BEFORE UPDATE ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_paid_invoice();

COMMENT ON TABLE public.sales_invoices IS 'جدول فواتير المبيعات للزبائن';
COMMENT ON TABLE public.sales_invoice_payments IS 'جدول دفعات فواتير المبيعات';