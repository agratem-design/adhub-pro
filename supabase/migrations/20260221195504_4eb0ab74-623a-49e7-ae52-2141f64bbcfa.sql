
-- جدول مجموعات لوحات البلدية
CREATE TABLE public.municipality_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'بلدية متوفرة',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول عناصر المجموعة
CREATE TABLE public.municipality_collection_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.municipality_collections(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  billboard_id INTEGER REFERENCES public.billboards("ID") ON DELETE SET NULL,
  billboard_name TEXT,
  size TEXT NOT NULL,
  faces_count TEXT DEFAULT 'وجهين',
  location_text TEXT,
  nearest_landmark TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  item_type TEXT NOT NULL DEFAULT 'existing' CHECK (item_type IN ('existing', 'new')),
  design_face_a TEXT,
  design_face_b TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(collection_id, sequence_number)
);

-- Enable RLS
ALTER TABLE public.municipality_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_collection_items ENABLE ROW LEVEL SECURITY;

-- Policies - allow authenticated users full access
CREATE POLICY "Authenticated users can manage collections" ON public.municipality_collections
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage collection items" ON public.municipality_collection_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Updated at triggers
CREATE TRIGGER update_municipality_collections_updated_at
  BEFORE UPDATE ON public.municipality_collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_municipality_collection_items_updated_at
  BEFORE UPDATE ON public.municipality_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
