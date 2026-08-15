
-- إنشاء جدول المصاريف والخسائر للعقود
CREATE TABLE IF NOT EXISTS public.contract_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  expense_type text NOT NULL CHECK (expense_type IN ('installation', 'print', 'rental')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.contract_expenses ENABLE ROW LEVEL SECURITY;

-- سياسة وصول كاملة للمشرفين
CREATE POLICY "Allow all access to contract_expenses"
  ON public.contract_expenses
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- علاقة مع جدول العقود
ALTER TABLE public.contract_expenses
  ADD CONSTRAINT fk_contract_expenses_contract
  FOREIGN KEY (contract_number)
  REFERENCES public."Contract"("Contract_Number")
  ON DELETE CASCADE;

-- trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION public.update_contract_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contract_expenses_updated_at
  BEFORE UPDATE ON public.contract_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_expenses_updated_at();
