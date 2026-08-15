-- إنشاء جدول الخصومات العامة للعملاء
CREATE TABLE IF NOT EXISTS customer_general_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  reason text,
  applied_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE customer_general_discounts ENABLE ROW LEVEL SECURITY;

-- السياسات الأمنية
CREATE POLICY "Admins manage general discounts"
ON customer_general_discounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users view general discounts"
ON customer_general_discounts
FOR SELECT
TO authenticated
USING (true);

-- إنشاء دالة لتحديث updated_at تلقائياً
CREATE TRIGGER update_customer_general_discounts_updated_at
BEFORE UPDATE ON customer_general_discounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- تعليق على الجدول
COMMENT ON TABLE customer_general_discounts IS 'الخصومات العامة المطبقة على حساب العميل بالكامل';
COMMENT ON COLUMN customer_general_discounts.discount_type IS 'نوع الخصم: نسبة مئوية أو مبلغ ثابت';
COMMENT ON COLUMN customer_general_discounts.discount_value IS 'قيمة الخصم (نسبة أو مبلغ)';
COMMENT ON COLUMN customer_general_discounts.status IS 'حالة الخصم: نشط أو غير نشط';