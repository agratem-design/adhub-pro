
-- تحديث دالة إنشاء المستخدم لدعم username
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
  INSERT INTO public.profiles (id, name, email, username, phone, company, approved, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'company',
    CASE WHEN user_role = 'admin' THEN true ELSE false END,
    CASE WHEN user_role = 'admin' THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    username = COALESCE(EXCLUDED.username, profiles.username),
    phone = EXCLUDED.phone,
    company = EXCLUDED.company;

  -- إنشاء دور للمستخدم
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
