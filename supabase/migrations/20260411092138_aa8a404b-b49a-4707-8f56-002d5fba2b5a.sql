
CREATE TABLE public.export_pricing (
  id SERIAL PRIMARY KEY,
  size TEXT NOT NULL,
  billboard_level TEXT NOT NULL DEFAULT 'A',
  customer_category TEXT NOT NULL DEFAULT 'عادي',
  one_month NUMERIC NOT NULL DEFAULT 0,
  "2_months" NUMERIC NOT NULL DEFAULT 0,
  "3_months" NUMERIC NOT NULL DEFAULT 0,
  "6_months" NUMERIC NOT NULL DEFAULT 0,
  full_year NUMERIC NOT NULL DEFAULT 0,
  one_day NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.export_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to export_pricing"
ON public.export_pricing FOR ALL
USING (true)
WITH CHECK (true);

INSERT INTO public.export_pricing (size, billboard_level, customer_category, one_month, "2_months", "3_months", "6_months", full_year, one_day)
SELECT size, billboard_level, customer_category, one_month, "2_months", "3_months", "6_months", full_year, one_day
FROM public.pricing;
