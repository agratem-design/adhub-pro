ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS stamp_image text,
  ADD COLUMN IF NOT EXISTS stamp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stamp_x integer NOT NULL DEFAULT 450,
  ADD COLUMN IF NOT EXISTS stamp_y integer NOT NULL DEFAULT 2990,
  ADD COLUMN IF NOT EXISTS stamp_width integer NOT NULL DEFAULT 380;

COMMENT ON COLUMN public.customers.stamp_image IS 'Customer stamp as a validated PNG/JPEG/WebP data URI for self-contained contract exports';
