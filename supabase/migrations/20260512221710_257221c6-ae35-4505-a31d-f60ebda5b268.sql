
-- Event contracts core table
CREATE TABLE IF NOT EXISTS public.event_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_contract_number text UNIQUE NOT NULL,
  customer_id uuid,
  customer_name text NOT NULL,
  event_name text NOT NULL,
  event_type text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_contract_billboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_contract_id uuid NOT NULL REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  billboard_id text NOT NULL,
  billboard_name text,
  daily_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_billboard_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id text NOT NULL,
  event_contract_id uuid NOT NULL REFERENCES public.event_contracts(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_resv_billboard ON public.event_billboard_reservations(billboard_id);
CREATE INDEX IF NOT EXISTS idx_event_resv_dates ON public.event_billboard_reservations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_event_contract_bbs ON public.event_contract_billboards(event_contract_id);

-- Sequence for human-readable number
CREATE SEQUENCE IF NOT EXISTS public.event_contract_seq START 1;

CREATE OR REPLACE FUNCTION public.set_event_contract_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_contract_number IS NULL OR NEW.event_contract_number = '' THEN
    NEW.event_contract_number := 'EVT-' || lpad(nextval('public.event_contract_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_event_contract_number ON public.event_contracts;
CREATE TRIGGER trg_set_event_contract_number
BEFORE INSERT ON public.event_contracts
FOR EACH ROW EXECUTE FUNCTION public.set_event_contract_number();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_event_contracts_updated_at ON public.event_contracts;
CREATE TRIGGER trg_event_contracts_updated_at
BEFORE UPDATE ON public.event_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: permissive for authenticated users (matches existing Contract pattern)
ALTER TABLE public.event_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_contract_billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_billboard_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth all event_contracts" ON public.event_contracts;
CREATE POLICY "auth all event_contracts" ON public.event_contracts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth all event_contract_billboards" ON public.event_contract_billboards;
CREATE POLICY "auth all event_contract_billboards" ON public.event_contract_billboards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth all event_billboard_reservations" ON public.event_billboard_reservations;
CREATE POLICY "auth all event_billboard_reservations" ON public.event_billboard_reservations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
