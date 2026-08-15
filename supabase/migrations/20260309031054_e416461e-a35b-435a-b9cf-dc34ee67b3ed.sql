
CREATE TABLE IF NOT EXISTS public.image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_url text NOT NULL,
  base64_data text NOT NULL,
  mime_type text DEFAULT 'image/jpeg',
  table_name text,
  field_name text,
  file_size integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(original_url)
);

ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to image_cache" ON public.image_cache FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_image_cache_url ON public.image_cache(original_url);
