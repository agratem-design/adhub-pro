-- إنشاء جدول المستخدمين البسيط للاختبارات
CREATE TABLE IF NOT EXISTS public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  phone TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- سياسة للسماح بتسجيل الدخول (قراءة البيانات)
CREATE POLICY "Allow login access" ON public.users
FOR SELECT 
USING (true);

-- سياسة للسماح بالتسجيل (إدراج مستخدم جديد)
CREATE POLICY "Allow user registration" ON public.users
FOR INSERT 
WITH CHECK (true);

-- إضافة مستخدم admin افتراضي للاختبار
INSERT INTO public.users (email, password, name, role) 
VALUES ('admin@test.com', 'admin123', 'المدير', 'admin')
ON CONFLICT (email) DO NOTHING;

-- إضافة مستخدم عادي للاختبار
INSERT INTO public.users (email, password, name, role) 
VALUES ('user@test.com', 'user123', 'مستخدم تجريبي', 'user')
ON CONFLICT (email) DO NOTHING;

-- وظيفة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ربط الوظيفة بالجدول
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();