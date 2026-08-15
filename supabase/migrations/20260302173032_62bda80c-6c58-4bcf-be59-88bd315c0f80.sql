
-- =====================================================
-- 1. إضافة أعمدة جديدة لجدول المصروفات
-- =====================================================

-- حالة السداد
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

-- تاريخ السداد الفعلي
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS paid_date date;

-- الموظف الذي صرف من حسابه الخاص
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL;

-- إضافة فهرس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON public.expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_employee_id ON public.expenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);

-- =====================================================
-- 2. جدول سجل أرصدة الموظفين (Employee Credit Ledger)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.employee_credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  expense_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL,
  entry_type text NOT NULL DEFAULT 'credit', -- credit = مستحق للموظف, debit = تم سداده للموظف
  amount numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  payment_method text, -- نقدي، تحويل بنكي، إلخ
  reference_number text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- فهارس
CREATE INDEX IF NOT EXISTS idx_employee_credit_employee ON public.employee_credit_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_credit_entry_type ON public.employee_credit_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_employee_credit_entry_date ON public.employee_credit_entries(entry_date);

-- RLS
ALTER TABLE public.employee_credit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view employee credits"
ON public.employee_credit_entries FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert employee credits"
ON public.employee_credit_entries FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update employee credits"
ON public.employee_credit_entries FOR UPDATE
TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete employee credits"
ON public.employee_credit_entries FOR DELETE
TO authenticated USING (true);

-- تحديث updated_at تلقائياً
CREATE TRIGGER update_employee_credit_entries_updated_at
BEFORE UPDATE ON public.employee_credit_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- =====================================================
-- 3. إضافة أعمدة لجدول expense_categories إن لم تكن موجودة
-- =====================================================
ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';

ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

ALTER TABLE public.expense_categories 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
