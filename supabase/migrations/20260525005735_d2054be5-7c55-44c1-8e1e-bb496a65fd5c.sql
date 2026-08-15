
-- Create cutout_workshops table (mirrors printers)
CREATE TABLE IF NOT EXISTS public.cutout_workshops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cutout_workshops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view cutout_workshops"
  ON public.cutout_workshops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert cutout_workshops"
  ON public.cutout_workshops FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update cutout_workshops"
  ON public.cutout_workshops FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete cutout_workshops"
  ON public.cutout_workshops FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_updated_at_cutout_workshops ON public.cutout_workshops;
CREATE TRIGGER set_updated_at_cutout_workshops
  BEFORE UPDATE ON public.cutout_workshops
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Storage bucket for mockup images
INSERT INTO storage.buckets (id, name, public)
VALUES ('mockup-images', 'mockup-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Mockup images public read"
  ON storage.objects FOR SELECT USING (bucket_id = 'mockup-images');
CREATE POLICY "Authenticated upload mockups"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'mockup-images');
CREATE POLICY "Authenticated update mockups"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'mockup-images');
CREATE POLICY "Authenticated delete mockups"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'mockup-images');
