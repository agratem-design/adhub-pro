-- إنشاء جدول العقود
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  ad_type TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rent_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تعديل جدول اللوحات لإضافة العلاقة مع العقود
ALTER TABLE public.billboards 
ADD COLUMN contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL,
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN customer_name TEXT;

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX idx_billboards_contract_id ON public.billboards(contract_id);
CREATE INDEX idx_billboards_end_date ON public.billboards(end_date);

-- تفعيل Row Level Security
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- إنشاء سياسات الأمان للعقود
CREATE POLICY "Admins can view all contracts" 
ON public.contracts 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admins can create contracts" 
ON public.contracts 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admins can update contracts" 
ON public.contracts 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admins can delete contracts" 
ON public.contracts 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- إضافة trigger لتحديث updated_at للعقود
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- دالة لتحرير اللوحات المنتهية الصلاحية تلقائياً
CREATE OR REPLACE FUNCTION public.auto_release_expired_billboards()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.billboards 
  SET 
    contract_id = NULL,
    start_date = NULL,
    end_date = NULL,
    customer_name = NULL,
    Status = 'available'
  WHERE 
    end_date < CURRENT_DATE 
    AND contract_id IS NOT NULL;
END;
$$;