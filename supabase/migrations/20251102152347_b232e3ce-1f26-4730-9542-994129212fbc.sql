-- إضافة حقل updated_at إذا لم يكن موجوداً
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- إضافة حقول الموافقة والصلاحيات
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- إضافة جدول الصلاحيات
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- تفعيل RLS على جدول الصلاحيات
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- سياسات RLS لجدول الصلاحيات
CREATE POLICY "Admins manage permissions"
ON public.user_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- تحديث المستخدمين الحاليين ليكونوا موافق عليهم
UPDATE public.profiles 
SET approved = TRUE, status = 'approved' 
WHERE approved IS FALSE OR status = 'pending';