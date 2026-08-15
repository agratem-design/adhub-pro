-- إنشاء جدول تاريخ اللوحات (Billboard History)
CREATE TABLE IF NOT EXISTS public.billboard_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id BIGINT NOT NULL,
  contract_number BIGINT,
  customer_name TEXT,
  ad_type TEXT,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER,
  rent_amount NUMERIC,
  installation_date DATE,
  design_face_a_url TEXT,
  design_face_b_url TEXT,
  design_name TEXT,
  installed_image_face_a_url TEXT,
  installed_image_face_b_url TEXT,
  team_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- إضافة index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_billboard_history_billboard_id ON public.billboard_history(billboard_id);
CREATE INDEX IF NOT EXISTS idx_billboard_history_contract_number ON public.billboard_history(contract_number);
CREATE INDEX IF NOT EXISTS idx_billboard_history_created_at ON public.billboard_history(created_at DESC);

-- تفعيل RLS
ALTER TABLE public.billboard_history ENABLE ROW LEVEL SECURITY;

-- سياسات RLS
CREATE POLICY "Admins manage billboard history"
  ON public.billboard_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Authenticated users view billboard history"
  ON public.billboard_history
  FOR SELECT
  USING (true);

-- دالة لإنشاء سجل تاريخي تلقائياً عند إتمام المهمة
CREATE OR REPLACE FUNCTION create_billboard_history_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عند تحديث حالة المهمة إلى completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- إدراج سجل في billboard_history لكل billboard في المهمة
    INSERT INTO public.billboard_history (
      billboard_id,
      contract_number,
      customer_name,
      ad_type,
      start_date,
      end_date,
      duration_days,
      rent_amount,
      installation_date,
      design_face_a_url,
      design_face_b_url,
      design_name,
      installed_image_face_a_url,
      installed_image_face_b_url,
      team_name,
      notes
    )
    SELECT 
      iti.billboard_id,
      c."Contract_Number",
      c."Customer Name",
      c."Ad Type",
      c."Contract Date",
      c."End Date",
      EXTRACT(DAY FROM (c."End Date" - c."Contract Date"))::INTEGER,
      c."Total Rent",
      iti.installation_date,
      COALESCE(td.design_face_a_url, iti.design_face_a),
      COALESCE(td.design_face_b_url, iti.design_face_b),
      td.design_name,
      iti.installed_image_face_a_url,
      iti.installed_image_face_b_url,
      team.team_name,
      iti.notes
    FROM public.installation_task_items iti
    LEFT JOIN public.task_designs td ON td.id = iti.selected_design_id
    LEFT JOIN public.installation_teams team ON team.id = NEW.team_id
    LEFT JOIN public."Contract" c ON c."Contract_Number" = NEW.contract_id
    WHERE iti.task_id = NEW.id
    AND iti.status = 'completed'
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger لحفظ الهيستوري تلقائياً
DROP TRIGGER IF EXISTS trigger_create_history_on_task_completion ON public.installation_tasks;
CREATE TRIGGER trigger_create_history_on_task_completion
  AFTER UPDATE ON public.installation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION create_billboard_history_on_completion();

COMMENT ON TABLE public.billboard_history IS 'سجل تاريخي لجميع التركيبات والعقود المنتهية للوحات الإعلانية';
COMMENT ON FUNCTION create_billboard_history_on_completion() IS 'دالة تلقائية لإنشاء سجل تاريخي عند إتمام مهمة التركيب';