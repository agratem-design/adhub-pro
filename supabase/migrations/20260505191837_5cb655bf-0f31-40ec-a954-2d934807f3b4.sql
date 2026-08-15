-- 1) Replace duration validation trigger to auto-normalize instead of failing
CREATE OR REPLACE FUNCTION public.validate_and_set_contract_duration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_months integer;
  v_computed_duration text;
BEGIN
  IF NEW."Contract Date" IS NULL OR NEW."End Date" IS NULL THEN
    RETURN NEW;
  END IF;

  v_days := (NEW."End Date" - NEW."Contract Date");

  IF v_days <= 0 THEN
    RAISE EXCEPTION 'خطأ في المدة: تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.';
  END IF;

  IF (v_days % 30 = 0) THEN
    v_months := v_days / 30;
    v_computed_duration := CASE
      WHEN v_months = 1 THEN 'شهر'
      WHEN v_months = 2 THEN 'شهرين'
      WHEN v_months BETWEEN 3 AND 10 THEN v_months::text || ' أشهر'
      ELSE v_months::text || ' شهر'
    END;
  ELSE
    v_computed_duration := v_days::text || ' يوم';
  END IF;

  -- Auto-normalize: always store the computed value (no exception on mismatch)
  NEW."Duration" := v_computed_duration;
  RETURN NEW;
END;
$$;

-- 2) Loans table
CREATE TABLE IF NOT EXISTS public.billboard_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_contract_number bigint NOT NULL,
  target_contract_number bigint NOT NULL,
  billboard_id bigint NOT NULL,
  loan_days integer NOT NULL CHECK (loan_days > 0),
  compensation_days integer NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','expired','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_billboard_loans_billboard ON public.billboard_loans(billboard_id);
CREATE INDEX IF NOT EXISTS idx_billboard_loans_source ON public.billboard_loans(source_contract_number);
CREATE INDEX IF NOT EXISTS idx_billboard_loans_target ON public.billboard_loans(target_contract_number);
CREATE INDEX IF NOT EXISTS idx_billboard_loans_status ON public.billboard_loans(status);

ALTER TABLE public.billboard_loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view loans" ON public.billboard_loans;
CREATE POLICY "Authenticated can view loans" ON public.billboard_loans
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert loans" ON public.billboard_loans;
CREATE POLICY "Authenticated can insert loans" ON public.billboard_loans
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update loans" ON public.billboard_loans;
CREATE POLICY "Authenticated can update loans" ON public.billboard_loans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can delete loans" ON public.billboard_loans;
CREATE POLICY "Authenticated can delete loans" ON public.billboard_loans
  FOR DELETE TO authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_billboard_loans_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_touch_billboard_loans ON public.billboard_loans;
CREATE TRIGGER trg_touch_billboard_loans
BEFORE UPDATE ON public.billboard_loans
FOR EACH ROW EXECUTE FUNCTION public.touch_billboard_loans_updated_at();