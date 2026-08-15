-- إصلاح أمني حرج: حذف جدول users الذي يحتوي على كلمات مرور بنص واضح
-- هذا الجدول يكرر وظيفة auth.users ويشكل خطراً أمنياً كبيراً

-- إضافة الأعمدة المفقودة إلى جدول profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS pricing_category text,
ADD COLUMN IF NOT EXISTS allowed_customers text[] DEFAULT '{}';

-- حذف جدول users الذي يحتوي على كلمات مرور واضحة
DROP TABLE IF EXISTS public.users CASCADE;