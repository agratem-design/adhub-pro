
-- جدول الصور الميدانية
CREATE TABLE public.field_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  bucket_url text,
  lat double precision,
  lng double precision,
  captured_at timestamptz,
  device_make text,
  device_model text,
  direction_degrees double precision,
  focal_length double precision,
  zoom_ratio double precision,
  orbit_radius_meters double precision DEFAULT 50,
  notes text,
  linked_billboard_id bigint REFERENCES public.billboards("ID") ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.field_photos ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للمستخدمين المسجلين
CREATE POLICY "Authenticated users can read field photos"
  ON public.field_photos FOR SELECT
  TO authenticated
  USING (true);

-- سياسة الإدراج للمستخدمين المسجلين
CREATE POLICY "Authenticated users can insert field photos"
  ON public.field_photos FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- سياسة التحديث للمستخدمين المسجلين
CREATE POLICY "Authenticated users can update field photos"
  ON public.field_photos FOR UPDATE
  TO authenticated
  USING (true);

-- سياسة الحذف للمستخدمين المسجلين
CREATE POLICY "Authenticated users can delete field photos"
  ON public.field_photos FOR DELETE
  TO authenticated
  USING (true);

-- إنشاء Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('field-photos', 'field-photos', true)
ON CONFLICT (id) DO NOTHING;

-- سياسة رفع الملفات
CREATE POLICY "Authenticated users can upload field photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'field-photos');

-- سياسة قراءة الملفات (عام)
CREATE POLICY "Anyone can read field photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'field-photos');

-- سياسة حذف الملفات
CREATE POLICY "Authenticated users can delete field photos storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'field-photos');
