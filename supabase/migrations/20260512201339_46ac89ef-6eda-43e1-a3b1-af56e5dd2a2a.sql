-- Trigger لتسجيل التغييرات
CREATE OR REPLACE FUNCTION public.log_contract_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.contract_history(contract_number, action, snapshot, changed_by)
  VALUES (
    COALESCE(NEW."Contract_Number", OLD."Contract_Number"),
    TG_OP,
    to_jsonb(COALESCE(NEW, OLD)),
    auth.uid()
  );
  RETURN NEW;
END; $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_contract_history') THEN
        CREATE TRIGGER trg_contract_history
        AFTER INSERT OR UPDATE ON public."Contract"
        FOR EACH ROW EXECUTE FUNCTION public.log_contract_changes();
    END IF;
END
$$;