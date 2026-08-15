ALTER TABLE public.paused_billboards
  ADD COLUMN IF NOT EXISTS full_price numeric,
  ADD COLUMN IF NOT EXISTS manual_refund numeric,
  ADD COLUMN IF NOT EXISTS original_start_date date,
  ADD COLUMN IF NOT EXISTS original_end_date date;

UPDATE public.paused_billboards
   SET full_price = COALESCE(full_price, net_rent, original_price)
 WHERE full_price IS NULL;