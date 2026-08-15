
-- Enum for status types
DO $$ BEGIN
  CREATE TYPE public.billboard_status_type AS ENUM ('torn_ad', 'size_changed', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Active statuses
CREATE TABLE IF NOT EXISTS public.billboard_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billboard_id bigint NOT NULL,
  contract_number bigint,
  status_type public.billboard_status_type NOT NULL,
  note text,
  old_size text,
  new_size text,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billboard_statuses_billboard ON public.billboard_statuses(billboard_id);
CREATE INDEX IF NOT EXISTS idx_billboard_statuses_active ON public.billboard_statuses(billboard_id, status_type) WHERE is_resolved = false;

-- History (append-only)
CREATE TABLE IF NOT EXISTS public.billboard_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid,
  billboard_id bigint NOT NULL,
  contract_number bigint,
  status_type public.billboard_status_type NOT NULL,
  event text NOT NULL,
  note text,
  old_size text,
  new_size text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bsh_billboard ON public.billboard_status_history(billboard_id, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_billboard_statuses_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_bs_updated_at ON public.billboard_statuses;
CREATE TRIGGER trg_bs_updated_at BEFORE UPDATE ON public.billboard_statuses
FOR EACH ROW EXECUTE FUNCTION public.tg_billboard_statuses_updated_at();

-- History trigger
CREATE OR REPLACE FUNCTION public.tg_billboard_statuses_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.billboard_status_history(status_id,billboard_id,contract_number,status_type,event,note,old_size,new_size,actor)
    VALUES (NEW.id,NEW.billboard_id,NEW.contract_number,NEW.status_type,'created',NEW.note,NEW.old_size,NEW.new_size,auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_resolved = true AND OLD.is_resolved = false THEN
      INSERT INTO public.billboard_status_history(status_id,billboard_id,contract_number,status_type,event,note,old_size,new_size,actor)
      VALUES (NEW.id,NEW.billboard_id,NEW.contract_number,NEW.status_type,'resolved',NEW.note,NEW.old_size,NEW.new_size,auth.uid());
    ELSE
      INSERT INTO public.billboard_status_history(status_id,billboard_id,contract_number,status_type,event,note,old_size,new_size,actor)
      VALUES (NEW.id,NEW.billboard_id,NEW.contract_number,NEW.status_type,'edited',NEW.note,NEW.old_size,NEW.new_size,auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_bs_history ON public.billboard_statuses;
CREATE TRIGGER trg_bs_history AFTER INSERT OR UPDATE ON public.billboard_statuses
FOR EACH ROW EXECUTE FUNCTION public.tg_billboard_statuses_history();

-- Auto size_changed on billboards.Size update for rented billboards
CREATE OR REPLACE FUNCTION public.tg_billboards_size_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW."Size" IS DISTINCT FROM OLD."Size" AND OLD."Size" IS NOT NULL AND NEW."Contract_Number" IS NOT NULL THEN
    INSERT INTO public.billboard_statuses(billboard_id, contract_number, status_type, old_size, new_size, note)
    VALUES (NEW."ID", NEW."Contract_Number", 'size_changed', OLD."Size", NEW."Size",
            'تم تغيير المقاس من ' || OLD."Size" || ' إلى ' || NEW."Size");
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_billboards_size_change ON public.billboards;
CREATE TRIGGER trg_billboards_size_change AFTER UPDATE OF "Size" ON public.billboards
FOR EACH ROW EXECUTE FUNCTION public.tg_billboards_size_change();

-- RLS
ALTER TABLE public.billboard_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_bs" ON public.billboard_statuses;
CREATE POLICY "auth_read_bs" ON public.billboard_statuses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_write_bs" ON public.billboard_statuses;
CREATE POLICY "auth_write_bs" ON public.billboard_statuses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_read_bsh" ON public.billboard_status_history;
CREATE POLICY "auth_read_bsh" ON public.billboard_status_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "auth_insert_bsh" ON public.billboard_status_history;
CREATE POLICY "auth_insert_bsh" ON public.billboard_status_history FOR INSERT TO authenticated WITH CHECK (true);
