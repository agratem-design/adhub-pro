-- Validate and normalize contract duration based on contract dates
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

  -- If user manually sends a duration, make sure it matches dates
  IF NEW."Duration" IS NOT NULL AND btrim(NEW."Duration") <> '' AND NEW."Duration" <> v_computed_duration THEN
    RAISE EXCEPTION 'خطأ في المدة: القيمة المدخلة (%) لا تطابق فرق التاريخين (%).', NEW."Duration", v_computed_duration;
  END IF;

  NEW."Duration" := v_computed_duration;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contract_duration ON public."Contract";

CREATE TRIGGER trg_validate_contract_duration
BEFORE INSERT OR UPDATE OF "Contract Date", "End Date", "Duration"
ON public."Contract"
FOR EACH ROW
EXECUTE FUNCTION public.validate_and_set_contract_duration();

-- Backfill existing rows with normalized durations
UPDATE public."Contract"
SET "Duration" = CASE
  WHEN ("End Date" - "Contract Date") % 30 = 0 THEN
    CASE
      WHEN (("End Date" - "Contract Date") / 30) = 1 THEN 'شهر'
      WHEN (("End Date" - "Contract Date") / 30) = 2 THEN 'شهرين'
      WHEN (("End Date" - "Contract Date") / 30) BETWEEN 3 AND 10 THEN (("End Date" - "Contract Date") / 30)::text || ' أشهر'
      ELSE (("End Date" - "Contract Date") / 30)::text || ' شهر'
    END
  ELSE ("End Date" - "Contract Date")::text || ' يوم'
END
WHERE "Contract Date" IS NOT NULL
  AND "End Date" IS NOT NULL
  AND ("End Date" - "Contract Date") > 0;