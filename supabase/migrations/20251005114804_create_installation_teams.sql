/*
  # إنشاء جدول فرق التركيب

  1. جدول جديد
    - `installation_teams`
      - `id` (uuid, primary key)
      - `team_name` (text) - اسم الفرقة
      - `sizes` (jsonb) - المقاسات المرتبطة بالفرقة
      - `created_at` (timestamptz) - تاريخ الإنشاء
      - `updated_at` (timestamptz) - تاريخ التعديل

  2. الأمان
    - تفعيل RLS على جدول `installation_teams`
    - سياسة للسماح للمستخدمين المصادق عليهم بالقراءة
    - سياسة للسماح للمستخدمين المصادق عليهم بالإضافة
    - سياسة للسماح للمستخدمين المصادق عليهم بالتعديل
    - سياسة للسماح للمستخدمين المصادق عليهم بالحذف
*/

CREATE TABLE IF NOT EXISTS installation_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  sizes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE installation_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view installation teams"
  ON installation_teams
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert installation teams"
  ON installation_teams
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation teams"
  ON installation_teams
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete installation teams"
  ON installation_teams
  FOR DELETE
  TO authenticated
  USING (true);