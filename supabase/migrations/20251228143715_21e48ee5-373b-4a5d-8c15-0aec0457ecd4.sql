-- إنشاء جدول بروفايلات إعدادات الطباعة
CREATE TABLE public.billboard_print_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name text NOT NULL,
  description text,
  settings_data jsonb NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billboard_print_profiles ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع
CREATE POLICY "Billboard print profiles are viewable by all" 
ON public.billboard_print_profiles 
FOR SELECT 
USING (true);

-- سياسة الإدراج للجميع (يمكن تقييدها لاحقاً حسب الدور)
CREATE POLICY "Billboard print profiles can be created" 
ON public.billboard_print_profiles 
FOR INSERT 
WITH CHECK (true);

-- سياسة التحديث للجميع
CREATE POLICY "Billboard print profiles can be updated" 
ON public.billboard_print_profiles 
FOR UPDATE 
USING (true);

-- سياسة الحذف للجميع
CREATE POLICY "Billboard print profiles can be deleted" 
ON public.billboard_print_profiles 
FOR DELETE 
USING (true);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_billboard_print_profiles_updated_at
BEFORE UPDATE ON public.billboard_print_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();