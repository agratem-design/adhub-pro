-- جدول لتخزين الخلفيات المستخدمة في الطباعة
CREATE TABLE public.print_backgrounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT DEFAULT 'general',
  is_default BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.print_backgrounds ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بالقراءة
CREATE POLICY "Anyone can view print backgrounds" 
ON public.print_backgrounds 
FOR SELECT 
USING (true);

-- السماح للمدراء بالتعديل
CREATE POLICY "Admins can manage print backgrounds" 
ON public.print_backgrounds 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- إضافة خلفيات افتراضية
INSERT INTO public.print_backgrounds (name, url, category, is_default) VALUES
('الخلفية الافتراضية', '/ipg.svg', 'general', true),
('خلفية ذهبية', 'https://lh3.googleusercontent.com/d/1qgKLCpd9b14m51mVxUMJ09SyzzfagMqB', 'general', false);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_print_backgrounds_updated_at
BEFORE UPDATE ON public.print_backgrounds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();