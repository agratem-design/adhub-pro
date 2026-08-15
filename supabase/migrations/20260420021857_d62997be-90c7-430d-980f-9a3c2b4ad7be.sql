ALTER TABLE public.municipality_collections
  ADD COLUMN IF NOT EXISTS municipality_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS default_size text;