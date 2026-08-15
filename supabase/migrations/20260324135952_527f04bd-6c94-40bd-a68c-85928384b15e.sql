
CREATE TABLE IF NOT EXISTS maintenance_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  color text DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE maintenance_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read maintenance_statuses"
  ON maintenance_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert maintenance_statuses"
  ON maintenance_statuses FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO maintenance_statuses (name, label, color) VALUES
  ('operational', 'تعمل بشكل طبيعي', '#22c55e'),
  ('maintenance', 'قيد الصيانة', '#eab308'),
  ('repair_needed', 'تحتاج إصلاح', '#ef4444'),
  ('out_of_service', 'خارج الخدمة', '#6b7280'),
  ('removed', 'تمت الإزالة', '#94a3b8'),
  ('لم يتم التركيب', 'لم يتم التركيب', '#f97316'),
  ('متضررة اللوحة', 'متضررة اللوحة', '#dc2626'),
  ('تحتاج ازالة لغرض التطوير', 'تحتاج إزالة للتطوير', '#a855f7')
ON CONFLICT (name) DO NOTHING;
