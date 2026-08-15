-- جدول مهام التركيب
CREATE TABLE IF NOT EXISTS installation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id BIGINT NOT NULL REFERENCES "Contract"("Contract_Number") ON DELETE CASCADE,
  team_id UUID REFERENCES installation_teams(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول تفاصيل مهام التركيب (اللوحات)
CREATE TABLE IF NOT EXISTS installation_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES installation_tasks(id) ON DELETE CASCADE,
  billboard_id BIGINT NOT NULL REFERENCES billboards("ID"),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
  completed_at TIMESTAMPTZ,
  installation_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول مهام الطباعة
CREATE TABLE IF NOT EXISTS print_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES printed_invoices(id),
  contract_id BIGINT REFERENCES "Contract"("Contract_Number"),
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  printer_id UUID REFERENCES printers(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, cancelled
  total_area NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- جدول تفاصيل مهام الطباعة
CREATE TABLE IF NOT EXISTS print_task_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES print_tasks(id) ON DELETE CASCADE,
  billboard_id BIGINT REFERENCES billboards("ID"),
  description TEXT,
  width NUMERIC,
  height NUMERIC,
  area NUMERIC,
  quantity INTEGER DEFAULT 1,
  unit_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, printing, completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes للأداء
CREATE INDEX idx_installation_tasks_contract ON installation_tasks(contract_id);
CREATE INDEX idx_installation_tasks_team ON installation_tasks(team_id);
CREATE INDEX idx_installation_tasks_status ON installation_tasks(status);
CREATE INDEX idx_installation_task_items_task ON installation_task_items(task_id);
CREATE INDEX idx_installation_task_items_billboard ON installation_task_items(billboard_id);
CREATE INDEX idx_print_tasks_status ON print_tasks(status);
CREATE INDEX idx_print_tasks_printer ON print_tasks(printer_id);
CREATE INDEX idx_print_task_items_task ON print_task_items(task_id);

-- RLS Policies
ALTER TABLE installation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_task_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on installation_tasks" ON installation_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on installation_task_items" ON installation_task_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on print_tasks" ON print_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on print_task_items" ON print_task_items FOR ALL USING (true) WITH CHECK (true);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_installation_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_installation_tasks_updated_at_trigger
BEFORE UPDATE ON installation_tasks
FOR EACH ROW
EXECUTE FUNCTION update_installation_tasks_updated_at();

CREATE TRIGGER update_print_tasks_updated_at_trigger
BEFORE UPDATE ON print_tasks
FOR EACH ROW
EXECUTE FUNCTION update_installation_tasks_updated_at();