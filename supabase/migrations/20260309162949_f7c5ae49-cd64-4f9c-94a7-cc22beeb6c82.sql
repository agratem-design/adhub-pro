
-- Add original date columns and extension tracking
ALTER TABLE "Contract"
  ADD COLUMN IF NOT EXISTS original_start_date date,
  ADD COLUMN IF NOT EXISTS original_end_date date,
  ADD COLUMN IF NOT EXISTS total_extension_days integer DEFAULT 0;

-- Populate from existing data
UPDATE "Contract"
SET original_start_date = "Contract Date"::date,
    original_end_date = "End Date"::date
WHERE original_start_date IS NULL
  AND "Contract Date" IS NOT NULL;

-- Protection trigger to prevent modifying original dates
CREATE OR REPLACE FUNCTION public.protect_original_dates()
RETURNS trigger AS $$
BEGIN
  IF OLD.original_start_date IS NOT NULL 
     AND NEW.original_start_date IS DISTINCT FROM OLD.original_start_date THEN
    NEW.original_start_date := OLD.original_start_date;
  END IF;
  IF OLD.original_end_date IS NOT NULL 
     AND NEW.original_end_date IS DISTINCT FROM OLD.original_end_date THEN
    NEW.original_end_date := OLD.original_end_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_original_dates_trigger ON "Contract";
CREATE TRIGGER protect_original_dates_trigger
  BEFORE UPDATE ON "Contract"
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_original_dates();
