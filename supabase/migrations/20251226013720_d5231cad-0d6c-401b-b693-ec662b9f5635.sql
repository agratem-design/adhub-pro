-- Create pricing_durations table for dynamic duration management
CREATE TABLE public.pricing_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  days INTEGER NOT NULL,
  months NUMERIC NOT NULL DEFAULT 0,
  db_column TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default durations
INSERT INTO public.pricing_durations (name, label, days, months, db_column, sort_order) VALUES
  ('شهر واحد', 'شهرياً', 30, 1, 'one_month', 1),
  ('2 أشهر', 'كل شهرين', 60, 2, '2_months', 2),
  ('3 أشهر', 'كل 3 أشهر', 90, 3, '3_months', 3),
  ('6 أشهر', 'كل 6 أشهر', 180, 6, '6_months', 4),
  ('سنة كاملة', 'سنوي', 365, 12, 'full_year', 5),
  ('يوم واحد', 'يومي', 1, 0, 'one_day', 6);

-- Enable RLS
ALTER TABLE public.pricing_durations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users view pricing durations" 
ON public.pricing_durations 
FOR SELECT 
USING (true);

CREATE POLICY "Admins manage pricing durations" 
ON public.pricing_durations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_pricing_durations_updated_at
  BEFORE UPDATE ON public.pricing_durations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();