ALTER TABLE public.paused_billboards
  ADD COLUMN IF NOT EXISTS price_before_discount numeric,
  ADD COLUMN IF NOT EXISTS net_after_discount numeric;