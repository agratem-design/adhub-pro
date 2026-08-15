
-- Create export_slides table for managing slide images in Excel export
CREATE TABLE public.export_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.export_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view export_slides"
  ON public.export_slides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert export_slides"
  ON public.export_slides FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update export_slides"
  ON public.export_slides FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete export_slides"
  ON public.export_slides FOR DELETE TO authenticated USING (true);

-- Create export_company_images table for managing company logos in Excel export
CREATE TABLE public.export_company_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.export_company_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view export_company_images"
  ON public.export_company_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert export_company_images"
  ON public.export_company_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update export_company_images"
  ON public.export_company_images FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete export_company_images"
  ON public.export_company_images FOR DELETE TO authenticated USING (true);
