-- Migration: 20260924000100_sync_contract_duration_trigger.sql
-- Description: Update validate_and_set_contract_duration trigger function to respect pricing_durations table naming and update contract 1308

CREATE OR REPLACE FUNCTION public.validate_and_set_contract_duration()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_days integer;
  v_months numeric;
  v_computed_duration text;
BEGIN
  IF NEW."Contract Date" IS NULL OR NEW."End Date" IS NULL THEN
    RETURN NEW;
  END IF;

  v_days := (NEW."End Date" - NEW."Contract Date");

  IF v_days <= 0 THEN
    RAISE EXCEPTION 'خطأ في المدة: تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.';
  END IF;

  -- 1. Try to match by duration_months in pricing_durations table
  IF NEW.duration_months IS NOT NULL AND NEW.duration_months > 0 THEN
    SELECT name INTO v_computed_duration
    FROM public.pricing_durations
    WHERE months = NEW.duration_months AND is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  -- 2. Try to match by exact days count in pricing_durations table
  IF v_computed_duration IS NULL THEN
    SELECT name INTO v_computed_duration
    FROM public.pricing_durations
    WHERE days = v_days AND is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  -- 3. Check if NEW."Duration" already matches an active duration name or label
  IF v_computed_duration IS NULL AND NEW."Duration" IS NOT NULL AND TRIM(NEW."Duration") != '' THEN
    SELECT name INTO v_computed_duration
    FROM public.pricing_durations
    WHERE (name = TRIM(NEW."Duration") OR label = TRIM(NEW."Duration")) AND is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  -- 4. Fallback calculation if not defined in pricing_durations
  IF v_computed_duration IS NULL THEN
    IF (v_days % 30 = 0) THEN
      v_months := v_days / 30;
      v_computed_duration := CASE
        WHEN v_months = 1 THEN 'شهر واحد'
        WHEN v_months = 2 THEN 'شهرين'
        WHEN v_months BETWEEN 3 AND 10 THEN v_months::text || ' أشهر'
        ELSE v_months::text || ' شهر'
      END;
    ELSE
      v_computed_duration := v_days::text || ' يوم';
    END IF;
  END IF;

  NEW."Duration" := v_computed_duration;
  RETURN NEW;
END;
$function$;

-- Update Contract 1308 to have clean duration 'شهر ونصف'
UPDATE public."Contract"
SET "Duration" = 'شهر ونصف'
WHERE "Contract_Number"::text = '1308';
