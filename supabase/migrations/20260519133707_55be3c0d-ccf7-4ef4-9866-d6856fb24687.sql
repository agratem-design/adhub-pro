CREATE TABLE public.paused_billboard_replacements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paused_billboard_id uuid NOT NULL UNIQUE REFERENCES public.paused_billboards(id) ON DELETE CASCADE,
  contract_number bigint NOT NULL,
  replacement_billboard_id bigint NOT NULL,
  replacement_billboard_name text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  allocated_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paused_billboard_replacements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_select_pbr" ON public.paused_billboard_replacements FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_all_insert_pbr" ON public.paused_billboard_replacements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_all_update_pbr" ON public.paused_billboard_replacements FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_all_delete_pbr" ON public.paused_billboard_replacements FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_pbr_contract ON public.paused_billboard_replacements(contract_number);
CREATE INDEX idx_pbr_paused ON public.paused_billboard_replacements(paused_billboard_id);

CREATE TRIGGER trg_pbr_updated_at
  BEFORE UPDATE ON public.paused_billboard_replacements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();