-- إنشاء جدول لحفظ إعدادات تخصيص طباعة اللوحات
CREATE TABLE public.billboard_print_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL DEFAULT 'default' UNIQUE,
  
  -- إعدادات صورة اللوحة الرئيسية
  main_image_top TEXT DEFAULT '90mm',
  main_image_left TEXT DEFAULT '50%',
  main_image_width TEXT DEFAULT '120mm',
  main_image_height TEXT DEFAULT '140mm',
  
  -- إعدادات صور التركيب (وجهين)
  installed_images_top TEXT DEFAULT '88mm',
  installed_images_left TEXT DEFAULT '50%',
  installed_images_width TEXT DEFAULT '180mm',
  installed_images_gap TEXT DEFAULT '5mm',
  installed_image_height TEXT DEFAULT '80mm',
  
  -- إعدادات التصاميم
  designs_top TEXT DEFAULT '178mm',
  designs_left TEXT DEFAULT '16mm',
  designs_width TEXT DEFAULT '178mm',
  designs_gap TEXT DEFAULT '10mm',
  design_image_height TEXT DEFAULT '42mm',
  
  -- إعدادات النصوص
  billboard_name_top TEXT DEFAULT '55.588mm',
  billboard_name_left TEXT DEFAULT '15.5%',
  billboard_name_font_size TEXT DEFAULT '20px',
  billboard_name_font_weight TEXT DEFAULT '500',
  billboard_name_color TEXT DEFAULT '#333',
  
  size_top TEXT DEFAULT '51mm',
  size_left TEXT DEFAULT '63%',
  size_font_size TEXT DEFAULT '41px',
  size_font_weight TEXT DEFAULT '500',
  size_color TEXT DEFAULT '#000',
  
  faces_count_top TEXT DEFAULT '63mm',
  faces_count_left TEXT DEFAULT '64%',
  faces_count_font_size TEXT DEFAULT '12px',
  faces_count_color TEXT DEFAULT '#000',
  
  contract_number_top TEXT DEFAULT '39.869mm',
  contract_number_right TEXT DEFAULT '22mm',
  contract_number_font_size TEXT DEFAULT '16px',
  contract_number_font_weight TEXT DEFAULT '500',
  
  installation_date_top TEXT DEFAULT '42.869mm',
  installation_date_right TEXT DEFAULT '116mm',
  installation_date_font_size TEXT DEFAULT '11px',
  
  team_name_top TEXT DEFAULT '81mm',
  team_name_right TEXT DEFAULT '72mm',
  team_name_font_size TEXT DEFAULT '14px',
  team_name_font_weight TEXT DEFAULT 'bold',
  
  location_info_top TEXT DEFAULT '233mm',
  location_info_left TEXT DEFAULT '0',
  location_info_width TEXT DEFAULT '150mm',
  location_info_font_size TEXT DEFAULT '16px',
  
  landmark_info_top TEXT DEFAULT '241mm',
  landmark_info_left TEXT DEFAULT '0mm',
  landmark_info_width TEXT DEFAULT '150mm',
  landmark_info_font_size TEXT DEFAULT '16px',
  
  -- إعدادات QR Code
  qr_top TEXT DEFAULT '255mm',
  qr_left TEXT DEFAULT '65mm',
  qr_size TEXT DEFAULT '30mm',
  
  -- إعدادات عامة
  primary_font TEXT DEFAULT 'Doran',
  secondary_font TEXT DEFAULT 'Manrope',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.billboard_print_customization ENABLE ROW LEVEL SECURITY;

-- سياسة للقراءة للجميع
CREATE POLICY "Anyone can read print customization"
ON public.billboard_print_customization
FOR SELECT
USING (true);

-- سياسة للتعديل للمستخدمين المسجلين
CREATE POLICY "Authenticated users can update print customization"
ON public.billboard_print_customization
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- سياسة للإضافة للمستخدمين المسجلين
CREATE POLICY "Authenticated users can insert print customization"
ON public.billboard_print_customization
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- إضافة سجل افتراضي
INSERT INTO public.billboard_print_customization (setting_key)
VALUES ('default');

-- Trigger لتحديث updated_at
CREATE TRIGGER update_billboard_print_customization_updated_at
BEFORE UPDATE ON public.billboard_print_customization
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();