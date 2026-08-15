-- جدول معاملات البلديات
CREATE TABLE public.municipality_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  municipality_name TEXT NOT NULL UNIQUE,
  factor DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول معاملات الفئات
CREATE TABLE public.category_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  factor DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- جدول الأسعار الأساسية حسب المقاس
CREATE TABLE public.base_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  size_name TEXT NOT NULL,
  billboard_level TEXT NOT NULL DEFAULT 'A',
  one_month DECIMAL(12,2) DEFAULT 0,
  two_months DECIMAL(12,2) DEFAULT 0,
  three_months DECIMAL(12,2) DEFAULT 0,
  six_months DECIMAL(12,2) DEFAULT 0,
  full_year DECIMAL(12,2) DEFAULT 0,
  one_day DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(size_name, billboard_level)
);

-- إضافة RLS
ALTER TABLE public.municipality_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_prices ENABLE ROW LEVEL SECURITY;

-- سياسات القراءة للجميع
CREATE POLICY "Anyone can read municipality_factors" ON public.municipality_factors FOR SELECT USING (true);
CREATE POLICY "Anyone can read category_factors" ON public.category_factors FOR SELECT USING (true);
CREATE POLICY "Anyone can read base_prices" ON public.base_prices FOR SELECT USING (true);

-- سياسات التعديل للمستخدمين المصادق عليهم
CREATE POLICY "Authenticated users can manage municipality_factors" ON public.municipality_factors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage category_factors" ON public.category_factors FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage base_prices" ON public.base_prices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- إدراج البلديات الموجودة كمعاملات افتراضية
INSERT INTO public.municipality_factors (municipality_name, factor, description)
SELECT DISTINCT "Municipality", 1.00, 'معامل افتراضي'
FROM public.billboards 
WHERE "Municipality" IS NOT NULL
ON CONFLICT (municipality_name) DO NOTHING;

-- إدراج الفئات الأساسية
INSERT INTO public.category_factors (category_name, factor, description) VALUES
('عادي', 1.00, 'السعر الأساسي للعملاء العاديين'),
('مسوق', 0.85, 'خصم 15% للمسوقين'),
('شركات', 0.80, 'خصم 20% للشركات')
ON CONFLICT (category_name) DO NOTHING;