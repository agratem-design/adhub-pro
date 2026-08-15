-- إضافة حقول الاستبدال وإعادة التركيب لجدول installation_task_items
ALTER TABLE public.installation_task_items 
  ADD COLUMN IF NOT EXISTS replacement_status text DEFAULT NULL 
    CHECK (replacement_status IN ('replaced', 'replacement', 'reinstalled')),
  ADD COLUMN IF NOT EXISTS replaced_by_item_id uuid REFERENCES installation_task_items(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replaces_item_id uuid REFERENCES installation_task_items(id) ON DELETE SET NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replacement_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS replacement_cost_bearer text DEFAULT NULL 
    CHECK (replacement_cost_bearer IN ('customer', 'company', 'split')),
  ADD COLUMN IF NOT EXISTS replacement_cost_percentage numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reinstall_count integer DEFAULT 0;

-- تعليق على الحقول
COMMENT ON COLUMN installation_task_items.replacement_status IS 'حالة الاستبدال: replaced=مستبدلة، replacement=بديلة، reinstalled=أعيد تركيبها';
COMMENT ON COLUMN installation_task_items.replacement_reason IS 'سبب الاستبدال/إعادة التركيب';
COMMENT ON COLUMN installation_task_items.replacement_cost_bearer IS 'من يتحمل التكلفة: customer/company/split';
COMMENT ON COLUMN installation_task_items.replacement_cost_percentage IS 'نسبة تحمل الزبون من التكلفة (عند split)';