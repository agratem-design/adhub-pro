-- جدول بنود العقد القابلة للتعديل
CREATE TABLE IF NOT EXISTS public.contract_terms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  term_key VARCHAR(100) NOT NULL UNIQUE,
  term_title VARCHAR(255) NOT NULL,
  term_content TEXT NOT NULL,
  term_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  font_size INTEGER DEFAULT 42,
  font_weight VARCHAR(50) DEFAULT 'normal',
  position_x INTEGER DEFAULT 1200,
  position_y INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- إضافة سياسة RLS
ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بالقراءة
CREATE POLICY "Allow public read access to contract_terms"
ON public.contract_terms
FOR SELECT
USING (true);

-- السماح للمستخدمين المسجلين بالتعديل
CREATE POLICY "Allow authenticated users to modify contract_terms"
ON public.contract_terms
FOR ALL
USING (true)
WITH CHECK (true);

-- إدراج البنود الافتراضية
INSERT INTO public.contract_terms (term_key, term_title, term_content, term_order, font_size, position_y) VALUES
('introduction', 'المقدمة', 'نظرًا لرغبة الطرف الثاني في استئجار مساحات إعلانية من الطرف الأول، تم الاتفاق على الشروط التالية:', 0, 46, 1550),
('term_1', 'البند الأول', 'يلتزم الطرف الثاني بتجهيز التصميم في أسرع وقت وأي تأخير يعتبر مسؤوليته، وتبدأ مدة العقد من التاريخ المذكور في المادة السادسة.', 1, 46, 1650),
('term_2', 'البند الثاني', 'يلتزم الطرف الأول بتعبئة وتركيب التصاميم بدقة على المساحات المتفق عليها وفق الجدول المرفق، ويتحمل الطرف الثاني تكاليف التغيير الناتجة عن الأحوال الجوية الشديدة مثل الأعاصير والعواصف القوية أو الحوادث الطارئة.', 2, 42, 1825),
('term_3', 'البند الثالث', 'في حال وقوع ظروف قاهرة تؤثر على إحدى المساحات الإعلانية، يتم نقل الإعلان إلى موقع بديل، ويتحمل الطرف الأول تكلفة النقل، ويجوز للطرف الثاني المشاركة بجزء من التكاليف حسب الاتفاق، ويتولى الطرف الأول الحصول على الموافقات اللازمة من الجهات ذات العلاقة.', 3, 42, 1975),
('term_4', 'البند الرابع', 'لا يجوز للطرف الثاني التنازل عن العقد أو التعامل مع جهات أخرى دون موافقة الطرف الأول، الذي يحتفظ بحق استغلال المساحات في المناسبات الوطنية والانتخابات مع تعويض الطرف الثاني بفترة بديلة.', 4, 46, 2150),
('term_5', 'البند الخامس', 'يتم السداد وفقاً للدفعات المتفق عليها، وإذا تأخر السداد عن 30 يومًا يحق للطرف الأول إعادة تأجير المساحات.', 5, 42, 2300),
('term_6', 'البند السادس', 'مدة العقد {duration} يومًا تبدأ من {startDate} وتنتهي في {endDate}، ويجوز تجديده برضى الطرفين قبل انتهائه بمدة لا تقل عن 15 يومًا وفق شروط يتم الاتفاق عليها. تُمنح للطرف الأول فترة لا تتجاوز 15 يومًا من تاريخ بدء العقد لتركيب اللوحات، وفي حال تأخر التركيب عن هذه المدة، يتم تعويض الطرف الثاني عن فترة التأخير بما يعادل المدة التي تأخر فيها التنفيذ.', 6, 42, 2450),
('term_7', 'البند السابع', 'في حال حدوث خلاف بين الطرفين يتم حلّه وديًا، وإذا تعذر ذلك يُعين طرفان محاميان لتسوية النزاع بقرار نهائي وملزم للطرفين.', 7, 46, 2760)
ON CONFLICT (term_key) DO NOTHING;

-- إضافة trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_contract_terms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contract_terms_timestamp ON public.contract_terms;
CREATE TRIGGER update_contract_terms_timestamp
BEFORE UPDATE ON public.contract_terms
FOR EACH ROW
EXECUTE FUNCTION update_contract_terms_updated_at();