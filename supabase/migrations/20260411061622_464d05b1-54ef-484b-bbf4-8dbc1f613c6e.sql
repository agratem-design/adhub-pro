CREATE TABLE public.export_city_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city_name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.export_city_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view city images"
  ON public.export_city_images FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert city images"
  ON public.export_city_images FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update city images"
  ON public.export_city_images FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete city images"
  ON public.export_city_images FOR DELETE
  TO authenticated
  USING (true);