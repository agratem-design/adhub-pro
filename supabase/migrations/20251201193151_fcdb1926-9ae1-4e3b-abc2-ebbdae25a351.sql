-- Create custody accounts table (العهد المالية)
CREATE TABLE IF NOT EXISTS public.custody_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  account_number TEXT UNIQUE NOT NULL,
  initial_amount NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custody transactions table (حركات العهدة)
CREATE TABLE IF NOT EXISTS public.custody_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_account_id UUID NOT NULL REFERENCES public.custody_accounts(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  receipt_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create custody expenses table (مصروفات العهدة)
CREATE TABLE IF NOT EXISTS public.custody_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_account_id UUID NOT NULL REFERENCES public.custody_accounts(id) ON DELETE CASCADE,
  expense_category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  receipt_number TEXT,
  vendor_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_custody_accounts_employee ON public.custody_accounts(employee_id);
CREATE INDEX IF NOT EXISTS idx_custody_accounts_status ON public.custody_accounts(status);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_account ON public.custody_transactions(custody_account_id);
CREATE INDEX IF NOT EXISTS idx_custody_transactions_date ON public.custody_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_custody_expenses_account ON public.custody_expenses(custody_account_id);
CREATE INDEX IF NOT EXISTS idx_custody_expenses_date ON public.custody_expenses(expense_date);

-- Create trigger to update custody balance
CREATE OR REPLACE FUNCTION update_custody_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transaction_type = 'deposit' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance + NEW.amount
      WHERE id = NEW.custody_account_id;
    ELSIF NEW.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance - NEW.amount
      WHERE id = NEW.custody_account_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.transaction_type = 'deposit' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance - OLD.amount
      WHERE id = OLD.custody_account_id;
    ELSIF OLD.transaction_type = 'withdrawal' THEN
      UPDATE custody_accounts 
      SET current_balance = current_balance + OLD.amount
      WHERE id = OLD.custody_account_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custody_balance
AFTER INSERT OR DELETE ON public.custody_transactions
FOR EACH ROW EXECUTE FUNCTION update_custody_balance();

-- Create trigger to update custody on expense
CREATE OR REPLACE FUNCTION update_custody_on_expense()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE custody_accounts 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.custody_account_id;
    
    INSERT INTO custody_transactions (
      custody_account_id,
      transaction_type,
      amount,
      transaction_date,
      description,
      receipt_number
    ) VALUES (
      NEW.custody_account_id,
      'expense',
      NEW.amount,
      NEW.expense_date,
      NEW.description,
      NEW.receipt_number
    );
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE custody_accounts 
    SET current_balance = current_balance + OLD.amount
    WHERE id = OLD.custody_account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_custody_on_expense
AFTER INSERT OR DELETE ON public.custody_expenses
FOR EACH ROW EXECUTE FUNCTION update_custody_on_expense();

-- Enable RLS
ALTER TABLE public.custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_expenses ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins manage custody accounts"
  ON public.custody_accounts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view custody accounts"
  ON public.custody_accounts FOR SELECT
  USING (true);

CREATE POLICY "Admins manage custody transactions"
  ON public.custody_transactions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view custody transactions"
  ON public.custody_transactions FOR SELECT
  USING (true);

CREATE POLICY "Admins manage custody expenses"
  ON public.custody_expenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view custody expenses"
  ON public.custody_expenses FOR SELECT
  USING (true);

-- Add comments
COMMENT ON TABLE public.custody_accounts IS 'العهد المالية للموظفين';
COMMENT ON TABLE public.custody_transactions IS 'حركات العهدة المالية';
COMMENT ON TABLE public.custody_expenses IS 'مصروفات العهدة';

COMMENT ON COLUMN public.custody_accounts.status IS 'active, closed';
COMMENT ON COLUMN public.custody_transactions.transaction_type IS 'deposit, withdrawal, expense';