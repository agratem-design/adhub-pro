-- Create offers table for storing price quotes
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id),
  start_date DATE NOT NULL,
  end_date DATE,
  duration_months INTEGER NOT NULL DEFAULT 3,
  total NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  billboards_count INTEGER DEFAULT 0,
  billboards_data JSONB,
  notes TEXT,
  pricing_category TEXT,
  currency TEXT DEFAULT 'LYD',
  exchange_rate NUMERIC DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins manage offers" ON public.offers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users view offers" ON public.offers
  FOR SELECT USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();