-- Keep custom prices under existing size / level / customer records and RLS.
ALTER TABLE public.pricing ADD COLUMN IF NOT EXISTS duration_prices jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public."Contract" ALTER COLUMN duration_months TYPE numeric USING duration_months::numeric;
ALTER TABLE public.offers ALTER COLUMN duration_months TYPE numeric USING duration_months::numeric;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS duration_label text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS use_30_day_month boolean;
