
-- حذف الـ triggers القديمة أولاً
DROP TRIGGER IF EXISTS auto_assign_admin_on_profile_create ON public.profiles;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- حذف الدوال القديمة مع CASCADE
DROP FUNCTION IF EXISTS public.auto_assign_admin_role() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- إضافة عمود اسم المستخدم للـ profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- إنشاء فهرس للبحث السريع باسم المستخدم
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- إنشاء دالة إنشاء المستخدم الجديد مع profile و role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role := 'user';
BEGIN
  -- تحديد الدور (admin للإيميلات التجريبية)
  IF NEW.email LIKE '%@test.com' OR NEW.email = 'admin@test.com' THEN
    user_role := 'admin';
  END IF;

  -- إنشاء profile للمستخدم الجديد
  INSERT INTO public.profiles (id, name, email, phone, company, approved, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'company',
    CASE WHEN user_role = 'admin' THEN true ELSE false END,
    CASE WHEN user_role = 'admin' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    company = EXCLUDED.company;

  -- إنشاء دور للمستخدم
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- إنشاء trigger على auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- سياسات RLS للـ profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Authenticated users view profiles" ON public.profiles;
CREATE POLICY "Authenticated users view profiles"
ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;
CREATE POLICY "Admins manage all profiles"
ON public.profiles FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
