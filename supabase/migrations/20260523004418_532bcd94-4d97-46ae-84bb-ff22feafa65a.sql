CREATE TABLE IF NOT EXISTS public.billboard_report_phrases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phrase TEXT NOT NULL UNIQUE,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billboard_report_phrases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read phrases"
ON public.billboard_report_phrases FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert phrases"
ON public.billboard_report_phrases FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update phrases"
ON public.billboard_report_phrases FOR UPDATE
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_brp_usage ON public.billboard_report_phrases (usage_count DESC);

CREATE TRIGGER update_brp_updated_at
BEFORE UPDATE ON public.billboard_report_phrases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();