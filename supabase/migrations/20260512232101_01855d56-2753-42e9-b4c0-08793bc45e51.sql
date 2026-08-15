
-- 1) paused_billboards table
CREATE TABLE IF NOT EXISTS public.paused_billboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number BIGINT NOT NULL,
  billboard_id BIGINT NOT NULL,
  billboard_name TEXT,
  pause_date DATE NOT NULL,
  original_price NUMERIC NOT NULL DEFAULT 0,
  consumed_amount NUMERIC NOT NULL DEFAULT 0,
  refund_amount NUMERIC NOT NULL DEFAULT 0,
  deducted_from_contract BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paused_billboards_contract ON public.paused_billboards(contract_number);
CREATE INDEX IF NOT EXISTS idx_paused_billboards_billboard ON public.paused_billboards(billboard_id);

ALTER TABLE public.paused_billboards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read paused_billboards" ON public.paused_billboards;
CREATE POLICY "Authenticated can read paused_billboards" ON public.paused_billboards
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert paused_billboards" ON public.paused_billboards;
CREATE POLICY "Authenticated can insert paused_billboards" ON public.paused_billboards
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update paused_billboards" ON public.paused_billboards;
CREATE POLICY "Authenticated can update paused_billboards" ON public.paused_billboards
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete paused_billboards" ON public.paused_billboards;
CREATE POLICY "Authenticated can delete paused_billboards" ON public.paused_billboards
  FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_paused_billboards_updated_at ON public.paused_billboards;
CREATE TRIGGER trg_paused_billboards_updated_at
  BEFORE UPDATE ON public.paused_billboards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Auto-generate event_contract_number
CREATE SEQUENCE IF NOT EXISTS public.event_contract_seq START 1;
ALTER TABLE public.event_contracts
  ALTER COLUMN event_contract_number
  SET DEFAULT 'EVT-' || lpad(nextval('public.event_contract_seq')::text, 5, '0');
