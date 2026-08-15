/*
  # إنشاء جداول المصروفات والرواتب

  1. جداول جديدة
    - `expenses` - المصروفات العامة
      - `id` (uuid, primary key)
      - `amount` (numeric) - المبلغ
      - `description` (text) - الوصف
      - `category` (text) - الفئة
      - `date` (date) - التاريخ
      - `payment_method` (text) - طريقة الدفع
      - `created_by` (uuid) - المستخدم الذي أضاف المصروف
      - `created_at` (timestamptz) - تاريخ الإنشاء
      - `updated_at` (timestamptz) - تاريخ التعديل
      
    - `expenses_withdrawals` - سحوبات المصروفات
      - `id` (uuid, primary key)
      - `amount` (numeric) - المبلغ المسحوب
      - `date` (date) - تاريخ السحب
      - `method` (text) - طريقة السحب
      - `note` (text) - ملاحظات
      - `created_at` (timestamptz) - تاريخ الإنشاء
      
    - `expenses_flags` - علامات العقود المستثناة من المصروفات
      - `id` (uuid, primary key)
      - `contract_id` (text) - رقم العقد
      - `excluded` (boolean) - مستثنى أم لا
      - `created_at` (timestamptz) - تاريخ الإنشاء
      
    - `period_closures` - إغلاق الفترات
      - `id` (serial, primary key)
      - `closure_date` (date) - تاريخ الإغلاق
      - `closure_type` (text) - نوع الإغلاق
      - `period_start` (date) - بداية الفترة
      - `period_end` (date) - نهاية الفترة
      - `contract_start` (text) - رقم عقد البداية
      - `contract_end` (text) - رقم عقد النهاية
      - `total_contracts` (integer) - عدد العقود
      - `total_amount` (numeric) - المبلغ الإجمالي
      - `total_withdrawn` (numeric) - المبلغ المسحوب
      - `remaining_balance` (numeric) - الرصيد المتبقي
      - `notes` (text) - ملاحظات
      - `created_at` (timestamptz) - تاريخ الإنشاء
      
    - `salaries` - الرواتب
      - `id` (uuid, primary key)
      - `employee_name` (text) - اسم الموظف
      - `position` (text) - الوظيفة
      - `salary_amount` (numeric) - مبلغ الراتب
      - `payment_date` (date) - تاريخ الدفع
      - `payment_method` (text) - طريقة الدفع
      - `notes` (text) - ملاحظات
      - `status` (text) - الحالة (مدفوع/معلق)
      - `created_by` (uuid) - المستخدم الذي أضاف الراتب
      - `created_at` (timestamptz) - تاريخ الإنشاء
      - `updated_at` (timestamptz) - تاريخ التعديل

  2. الأمان
    - تفعيل RLS على جميع الجداول
    - سياسات للمستخدمين المصادقين للقراءة والكتابة
*/

-- جدول المصروفات
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL DEFAULT 0,
  description text NOT NULL,
  category text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete expenses"
  ON expenses FOR DELETE
  TO authenticated
  USING (true);

-- جدول سحوبات المصروفات
CREATE TABLE IF NOT EXISTS expenses_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric NOT NULL DEFAULT 0,
  date date NOT NULL DEFAULT CURRENT_DATE,
  method text DEFAULT '',
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read withdrawals"
  ON expenses_withdrawals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert withdrawals"
  ON expenses_withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update withdrawals"
  ON expenses_withdrawals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete withdrawals"
  ON expenses_withdrawals FOR DELETE
  TO authenticated
  USING (true);

-- جدول علامات العقود المستثناة
CREATE TABLE IF NOT EXISTS expenses_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id text NOT NULL UNIQUE,
  excluded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read flags"
  ON expenses_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert flags"
  ON expenses_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update flags"
  ON expenses_flags FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete flags"
  ON expenses_flags FOR DELETE
  TO authenticated
  USING (true);

-- جدول إغلاق الفترات
CREATE TABLE IF NOT EXISTS period_closures (
  id serial PRIMARY KEY,
  closure_date date NOT NULL DEFAULT CURRENT_DATE,
  closure_type text NOT NULL DEFAULT 'period',
  period_start date,
  period_end date,
  contract_start text,
  contract_end text,
  total_contracts integer DEFAULT 0,
  total_amount numeric DEFAULT 0,
  total_withdrawn numeric DEFAULT 0,
  remaining_balance numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE period_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read closures"
  ON period_closures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert closures"
  ON period_closures FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update closures"
  ON period_closures FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete closures"
  ON period_closures FOR DELETE
  TO authenticated
  USING (true);

-- جدول الرواتب
CREATE TABLE IF NOT EXISTS salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL,
  position text DEFAULT '',
  salary_amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'نقدي',
  notes text DEFAULT '',
  status text DEFAULT 'معلق',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read salaries"
  ON salaries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert salaries"
  ON salaries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update salaries"
  ON salaries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete salaries"
  ON salaries FOR DELETE
  TO authenticated
  USING (true);
