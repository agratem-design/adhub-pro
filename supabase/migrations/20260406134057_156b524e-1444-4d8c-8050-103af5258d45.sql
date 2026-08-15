
ALTER TABLE public.billboards ADD COLUMN IF NOT EXISTS own_company_id uuid REFERENCES public.friend_companies(id);

CREATE INDEX IF NOT EXISTS idx_billboards_own_company_id ON public.billboards(own_company_id);
