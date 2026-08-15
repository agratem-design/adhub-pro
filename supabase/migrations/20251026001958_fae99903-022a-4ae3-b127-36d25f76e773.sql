-- إنشاء جدول فواتير الطباعة
CREATE TABLE IF NOT EXISTS public.printed_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  printer_id UUID REFERENCES public.printers(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_name TEXT,
  contract_number BIGINT,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- تفعيل RLS
ALTER TABLE public.printed_invoices ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول لفواتير الطباعة
CREATE POLICY "Allow authenticated users to view printed invoices"
  ON public.printed_invoices FOR SELECT
  USING (true);

CREATE POLICY "Allow admins to manage printed invoices"
  ON public.printed_invoices FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- دالة تحديث updated_at لفواتير الطباعة
CREATE OR REPLACE FUNCTION public.update_printed_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- trigger للتحديث التلقائي
CREATE TRIGGER update_printed_invoices_updated_at
  BEFORE UPDATE ON public.printed_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_printed_invoices_updated_at();

-- فهرس لتسريع البحث
CREATE INDEX IF NOT EXISTS idx_printed_invoices_printer_id ON public.printed_invoices(printer_id);
CREATE INDEX IF NOT EXISTS idx_printed_invoices_customer_id ON public.printed_invoices(customer_id);