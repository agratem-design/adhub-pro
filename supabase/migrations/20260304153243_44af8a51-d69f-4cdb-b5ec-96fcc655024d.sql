
CREATE TABLE public.installation_photo_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_item_id uuid NOT NULL,
  billboard_id bigint NOT NULL,
  task_id uuid NOT NULL,
  reinstall_number int NOT NULL DEFAULT 1,
  installed_image_face_a_url text,
  installed_image_face_b_url text,
  installation_date date,
  archived_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.installation_photo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read installation photo history"
  ON public.installation_photo_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert installation photo history"
  ON public.installation_photo_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_photo_history_task_item ON public.installation_photo_history(task_item_id);
CREATE INDEX idx_photo_history_billboard ON public.installation_photo_history(billboard_id);
