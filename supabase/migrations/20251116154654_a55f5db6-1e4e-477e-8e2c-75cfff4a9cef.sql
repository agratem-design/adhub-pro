-- إنشاء جدول منفصل لمهام المجسمات (Cutout Tasks)
CREATE TABLE IF NOT EXISTS cutout_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_task_id uuid REFERENCES installation_tasks(id) ON DELETE CASCADE,
  contract_id bigint,
  customer_id uuid,
  customer_name text,
  printer_id uuid REFERENCES printers(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  total_quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  due_date date,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- إنشاء جدول عناصر مهام المجسمات
CREATE TABLE IF NOT EXISTS cutout_task_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES cutout_tasks(id) ON DELETE CASCADE,
  billboard_id bigint,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cutting', 'completed')),
  cutout_image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- إضافة RLS policies لمهام المجسمات
ALTER TABLE cutout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutout_task_items ENABLE ROW LEVEL SECURITY;

-- سياسات للمديرين
CREATE POLICY "Admins manage cutout tasks" ON cutout_tasks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage cutout task items" ON cutout_task_items
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- سياسات للقراءة للمستخدمين المصادقين
CREATE POLICY "Authenticated users view cutout tasks" ON cutout_tasks
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users view cutout task items" ON cutout_task_items
  FOR SELECT USING (true);

-- إضافة فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_cutout_tasks_installation_task ON cutout_tasks(installation_task_id);
CREATE INDEX IF NOT EXISTS idx_cutout_tasks_status ON cutout_tasks(status);
CREATE INDEX IF NOT EXISTS idx_cutout_task_items_task ON cutout_task_items(task_id);

-- إضافة عمود cutout_task_id في installation_tasks
ALTER TABLE installation_tasks 
ADD COLUMN IF NOT EXISTS cutout_task_id uuid REFERENCES cutout_tasks(id) ON DELETE SET NULL;