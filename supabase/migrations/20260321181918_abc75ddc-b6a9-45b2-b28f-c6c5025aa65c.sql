CREATE TABLE public.billboard_nearby_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id integer REFERENCES public.billboards("ID") ON DELETE CASCADE NOT NULL,
  business_name text NOT NULL,
  business_type text,
  phone text,
  address text,
  distance_estimate text,
  source text DEFAULT 'manual',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.billboard_nearby_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read" ON public.billboard_nearby_businesses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert" ON public.billboard_nearby_businesses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON public.billboard_nearby_businesses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON public.billboard_nearby_businesses FOR DELETE TO authenticated USING (true);