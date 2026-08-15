-- إنشاء دالة التحديث التلقائي للـ updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء جدول لتجميع المهام المترابطة (التركيب + الطباعة + القص)
CREATE TABLE IF NOT EXISTS public.composite_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- معلومات العقد والزبون
  contract_id BIGINT REFERENCES "Contract"("Contract_Number") ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  customer_name TEXT,
  
  -- نوع المهمة
  task_type TEXT NOT NULL CHECK (task_type IN ('new_installation', 'reinstallation')),
  
  -- ربط المهام
  installation_task_id UUID REFERENCES installation_tasks(id) ON DELETE CASCADE,
  print_task_id UUID REFERENCES print_tasks(id) ON DELETE SET NULL,
  cutout_task_id UUID REFERENCES cutout_tasks(id) ON DELETE SET NULL,
  
  -- التكاليف (قابلة للتعديل)
  installation_cost NUMERIC(10,2) DEFAULT 0,
  print_cost NUMERIC(10,2) DEFAULT 0,
  cutout_cost NUMERIC(10,2) DEFAULT 0,
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (
    COALESCE(installation_cost, 0) + COALESCE(print_cost, 0) + COALESCE(cutout_cost, 0)
  ) STORED,
  
  -- حالة المهمة المجمعة
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  
  -- الفاتورة الموحدة
  combined_invoice_id UUID REFERENCES printed_invoices(id) ON DELETE SET NULL,
  
  -- ملاحظات
  notes TEXT
);

-- Index للأداء
CREATE INDEX idx_composite_tasks_contract ON composite_tasks(contract_id);
CREATE INDEX idx_composite_tasks_customer ON composite_tasks(customer_id);
CREATE INDEX idx_composite_tasks_installation ON composite_tasks(installation_task_id);
CREATE INDEX idx_composite_tasks_status ON composite_tasks(status);

-- Trigger لتحديث updated_at
CREATE TRIGGER update_composite_tasks_updated_at
  BEFORE UPDATE ON composite_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS Policies
ALTER TABLE composite_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users" ON composite_tasks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON composite_tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON composite_tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON composite_tasks
  FOR DELETE USING (auth.role() = 'authenticated');

-- إضافة علاقة في print_tasks
ALTER TABLE print_tasks 
ADD COLUMN IF NOT EXISTS composite_task_id UUID REFERENCES composite_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_print_tasks_composite ON print_tasks(composite_task_id);

COMMENT ON TABLE composite_tasks IS 'يجمع مهام التركيب والطباعة والقص المترابطة في مهمة واحدة متسلسلة';
COMMENT ON COLUMN composite_tasks.task_type IS 'new_installation: تركيب جديد من العقد (شامل التركيب), reinstallation: إعادة تركيب (تكلفة منفصلة)';
COMMENT ON COLUMN composite_tasks.installation_cost IS 'تكلفة التركيب - قابلة للتعديل للزبون';
COMMENT ON COLUMN composite_tasks.print_cost IS 'تكلفة الطباعة - قابلة للتعديل للزبون';
COMMENT ON COLUMN composite_tasks.cutout_cost IS 'تكلفة القص - قابلة للتعديل للزبون';