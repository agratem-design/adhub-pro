
-- دالة لإعطاء صلاحية admin تلقائياً للمستخدمين من @test.com
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- إذا كان الإيميل ينتهي بـ @test.com أو يساوي admin@test.com
  IF NEW.email LIKE '%@test.com' OR NEW.email = 'admin@test.com' THEN
    -- إضافة دور admin
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger على جدول profiles
DROP TRIGGER IF EXISTS auto_assign_admin_on_profile_create ON public.profiles;
CREATE TRIGGER auto_assign_admin_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();

-- تحديث المستخدمين الموجودين حالياً بإيميل @test.com
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.email LIKE '%@test.com' OR p.email = 'admin@test.com'
ON CONFLICT (user_id, role) DO NOTHING;
