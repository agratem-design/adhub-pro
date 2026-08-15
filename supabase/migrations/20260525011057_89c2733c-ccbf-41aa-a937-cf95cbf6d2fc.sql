
ALTER TABLE public.installation_task_items
  ADD COLUMN IF NOT EXISTS cutout_workshop_id uuid REFERENCES public.cutout_workshops(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cutout_company_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cutout_customer_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cutout_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cutout_image_url text,
  ADD COLUMN IF NOT EXISTS cutout_notes text;

CREATE INDEX IF NOT EXISTS idx_installation_task_items_cutout_workshop
  ON public.installation_task_items(cutout_workshop_id);
