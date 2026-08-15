-- إضافة أعمدة جديدة لجدول billboard_history لتتبع معلومات التركيب والطباعة
ALTER TABLE public.billboard_history 
ADD COLUMN IF NOT EXISTS print_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS include_installation_in_price boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS include_print_in_price boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS pricing_category text,
ADD COLUMN IF NOT EXISTS pricing_mode text,
ADD COLUMN IF NOT EXISTS contract_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS contract_total_rent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS contract_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS individual_billboard_data jsonb;

-- إضافة تعليقات توضيحية
COMMENT ON COLUMN public.billboard_history.print_cost IS 'تكلفة الطباعة للوحة';
COMMENT ON COLUMN public.billboard_history.include_installation_in_price IS 'هل التركيب محسوب ضمن سعر اللوحة';
COMMENT ON COLUMN public.billboard_history.include_print_in_price IS 'هل الطباعة محسوبة ضمن سعر اللوحة';
COMMENT ON COLUMN public.billboard_history.pricing_category IS 'فئة التسعير (المدينة، الريف، إلخ)';
COMMENT ON COLUMN public.billboard_history.pricing_mode IS 'نمط التسعير (أشهر، أيام)';
COMMENT ON COLUMN public.billboard_history.individual_billboard_data IS 'بيانات اللوحة الفردية من العقد (JSON)';