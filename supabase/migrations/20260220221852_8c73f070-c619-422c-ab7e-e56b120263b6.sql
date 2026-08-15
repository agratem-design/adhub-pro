
-- ============================================
-- جدول مدفوعات المطابع
-- ============================================
CREATE TABLE IF NOT EXISTS public.printer_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printer_id UUID NOT NULL REFERENCES public.printers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'نقدي',
  reference TEXT NULL,
  notes TEXT NULL,
  print_task_id UUID NULL REFERENCES public.print_tasks(id) ON DELETE SET NULL,
  cutout_task_id UUID NULL REFERENCES public.cutout_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view printer payments"
  ON public.printer_payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert printer payments"
  ON public.printer_payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update printer payments"
  ON public.printer_payments FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete printer payments"
  ON public.printer_payments FOR DELETE
  USING (auth.role() = 'authenticated');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_printer_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_printer_payments_updated_at
  BEFORE UPDATE ON public.printer_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_printer_payments_updated_at();

-- ============================================
-- تحديث view حسابات المطابع لتشمل المدفوعات الجديدة
-- ============================================
DROP VIEW IF EXISTS public.printer_accounts;

CREATE VIEW public.printer_accounts AS
SELECT
  p.id AS printer_id,
  p.name AS printer_name,
  NULL::uuid AS customer_id,
  NULL::text AS customer_name,
  COALESCE(SUM(pt.total_cost), 0) AS total_print_costs,
  COALESCE(SUM(ct.total_cost), 0) AS total_cutout_costs,
  COALESCE(SUM(pt.total_cost), 0) + COALESCE(SUM(ct.total_cost), 0) AS total_supplier_debt,
  COALESCE(SUM(pp.amount), 0) AS total_payments_to_printer,
  0 AS total_customer_debt,
  0 AS total_customer_payments,
  (COALESCE(SUM(pt.total_cost), 0) + COALESCE(SUM(ct.total_cost), 0)) - COALESCE(SUM(pp.amount), 0) AS final_balance,
  COUNT(DISTINCT pt.id) AS print_tasks_count,
  COUNT(DISTINCT ct.id) AS cutout_tasks_count
FROM public.printers p
LEFT JOIN public.print_tasks pt ON pt.printer_id = p.id
LEFT JOIN public.cutout_tasks ct ON ct.printer_id = p.id
LEFT JOIN public.printer_payments pp ON pp.printer_id = p.id
GROUP BY p.id, p.name;
