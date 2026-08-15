
-- Create distributions table
CREATE TABLE public.distributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  size_filter TEXT NOT NULL,
  municipality_filter TEXT,
  city_filter TEXT,
  status_filter TEXT,
  ad_type_filter TEXT,
  distance_threshold INTEGER NOT NULL DEFAULT 175,
  partner_a_name TEXT NOT NULL DEFAULT 'الشريك أ',
  partner_b_name TEXT NOT NULL DEFAULT 'الشريك ب',
  is_active BOOLEAN NOT NULL DEFAULT false,
  total_billboards INTEGER NOT NULL DEFAULT 0,
  partner_a_count INTEGER NOT NULL DEFAULT 0,
  partner_b_count INTEGER NOT NULL DEFAULT 0,
  random_seed TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create distribution_items table
CREATE TABLE public.distribution_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distribution_id UUID NOT NULL REFERENCES public.distributions(id) ON DELETE CASCADE,
  billboard_id INTEGER NOT NULL,
  partner TEXT NOT NULL CHECK (partner IN ('A', 'B')),
  site_group TEXT,
  size_group TEXT,
  municipality_group TEXT,
  is_random BOOLEAN NOT NULL DEFAULT false,
  swap_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_items ENABLE ROW LEVEL SECURITY;

-- Policies - allow all authenticated users
CREATE POLICY "Allow all access to distributions" ON public.distributions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to distribution_items" ON public.distribution_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_distribution_items_distribution_id ON public.distribution_items(distribution_id);
CREATE INDEX idx_distribution_items_billboard_id ON public.distribution_items(billboard_id);
CREATE INDEX idx_distributions_size_filter ON public.distributions(size_filter);
CREATE INDEX idx_distributions_is_active ON public.distributions(is_active);

-- Updated at trigger
CREATE TRIGGER update_distributions_updated_at
BEFORE UPDATE ON public.distributions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
