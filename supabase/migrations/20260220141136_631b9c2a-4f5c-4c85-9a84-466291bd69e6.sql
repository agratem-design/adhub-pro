
-- جدول مركز تكلفة اللوحات
CREATE TABLE public.billboard_cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  billboard_id BIGINT NOT NULL REFERENCES public.billboards("ID") ON DELETE CASCADE,
  cost_type TEXT NOT NULL, -- 'land_rent', 'manufacturing', 'maintenance', 'printing', 'installation', 'other'
  amount NUMERIC NOT NULL DEFAULT 0,
  period_start DATE,
  period_end DATE,
  frequency TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly', 'one_time'
  vendor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billboard_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cost centers"
ON public.billboard_cost_centers FOR SELECT
TO authenticated
USING (public.has_permission(auth.uid(), 'billboards'));

CREATE POLICY "Admins can manage cost centers"
ON public.billboard_cost_centers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_billboard_cost_centers_updated_at
BEFORE UPDATE ON public.billboard_cost_centers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for fast lookup
CREATE INDEX idx_billboard_cost_centers_billboard ON public.billboard_cost_centers(billboard_id);
CREATE INDEX idx_billboard_cost_centers_type ON public.billboard_cost_centers(cost_type);
