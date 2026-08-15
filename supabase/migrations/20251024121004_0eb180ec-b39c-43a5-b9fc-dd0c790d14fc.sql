-- إنشاء جدول مشتريات العملاء
CREATE TABLE IF NOT EXISTS public.customer_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT,
  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إضافة RLS policies
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on customer_purchases"
  ON public.customer_purchases
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- إنشاء جدول دفعات فواتير الطباعة
CREATE TABLE IF NOT EXISTS public.print_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.printed_invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  payment_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- إضافة RLS policies
ALTER TABLE public.print_invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on print_invoice_payments"
  ON public.print_invoice_payments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- إضافة عمود لتتبع المدفوع من فواتير الطباعة
ALTER TABLE public.printed_invoices 
ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- تحديث السجلات الموجودة
UPDATE public.printed_invoices 
SET paid_amount = total_amount 
WHERE paid = true AND (paid_amount IS NULL OR paid_amount = 0);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_customer_purchases_customer_id ON public.customer_purchases(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_purchases_date ON public.customer_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_print_invoice_payments_invoice_id ON public.print_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_print_invoice_payments_customer_id ON public.print_invoice_payments(customer_id);