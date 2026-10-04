-- نسخة من قائمة أسعار فئة الزبون وقت حفظ العقد/العرض
ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS pricing_snapshot jsonb;
COMMENT ON COLUMN public."Contract".pricing_snapshot IS 'Snapshot of the pricing rows (customer category + عادي) at the time the contract prices were set';
COMMENT ON COLUMN public.offers.pricing_snapshot IS 'Snapshot of the pricing rows (customer category + عادي) at the time the offer prices were set';
