CREATE TABLE IF NOT EXISTS public.event_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size text NOT NULL,
  billboard_level text NOT NULL DEFAULT 'عادي',
  customer_category text NOT NULL DEFAULT 'عادي',
  one_day numeric NOT NULL DEFAULT 0,
  duration_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_pricing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated manage event pricing" ON public.event_pricing;
CREATE POLICY "authenticated manage event pricing" ON public.event_pricing FOR ALL TO authenticated USING (true) WITH CHECK (true);
