
-- جدول أسعار إيجار المتر حسب البلدية (سنوي)
CREATE TABLE public.municipality_rent_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_name TEXT NOT NULL UNIQUE,
  price_per_meter NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'LYD',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.municipality_rent_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view municipality rent prices"
ON public.municipality_rent_prices FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admins can manage municipality rent prices"
ON public.municipality_rent_prices FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_municipality_rent_prices_updated_at
BEFORE UPDATE ON public.municipality_rent_prices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
