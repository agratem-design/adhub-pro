-- sql/sync_municipalities_from_billboards.sql
-- Detects city column on billboards, inserts municipalities from distinct city names,
-- assigns generated codes, and links billboards to municipalities by municipality_id.

DO $$
DECLARE
  city_col text := NULL;
  inserted_count int := 0;
  updated_count int := 0;
BEGIN
  -- ensure municipalities table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='municipalities') THEN
    RAISE EXCEPTION 'Table public.municipalities does not exist. Run sql/create_municipalities.sql first.';
  END IF;

  -- detect city column name in billboards
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='city') THEN
    city_col := 'city';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='City') THEN
    city_col := 'City';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='City_Name') THEN
    city_col := 'City_Name';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='CityName') THEN
    city_col := 'CityName';
  END IF;

  IF city_col IS NULL THEN
    RAISE NOTICE 'No city column found on public.billboards. Skipping sync.';
    RETURN;
  END IF;

  -- add municipality_id column if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='municipality_id') THEN
    EXECUTE 'ALTER TABLE public.billboards ADD COLUMN municipality_id uuid';
    RAISE NOTICE 'Added municipality_id column to public.billboards';
  END IF;

  -- Insert distinct municipalities from billboards where not already present
  EXECUTE format($f$
    INSERT INTO public.municipalities (name, code, created_at)
    SELECT DISTINCT TRIM(%1$I)::text AS name,
           upper(substr(md5(TRIM(%1$I)::text),1,6)) AS code,
           now()
    FROM public.billboards b
    WHERE %1$I IS NOT NULL AND trim(%1$I) <> ''
      AND TRIM(%1$I) NOT IN (SELECT name FROM public.municipalities)
  $f$, city_col);

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE 'Inserted % rows into municipalities', inserted_count;

  -- Update billboards.municipality_id by matching names (trimmed)
  EXECUTE format($f$
    UPDATE public.billboards AS bb
    SET municipality_id = m.id
    FROM public.municipalities m
    WHERE m.name = TRIM(bb.%1$I)::text
      AND (bb.municipality_id IS NULL OR bb.municipality_id <> m.id)
  $f$, city_col);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % billboards with municipality_id', updated_count;

  -- Create index and FK if possible
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_billboards_municipality') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='billboards' AND column_name='municipality_id') THEN
      BEGIN
        ALTER TABLE public.billboards
          ADD CONSTRAINT fk_billboards_municipality FOREIGN KEY (municipality_id) REFERENCES public.municipalities(id) ON DELETE SET NULL;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        RAISE NOTICE 'Could not add FK fk_billboards_municipality now; try adding later.';
      END;
    END IF;
  END IF;

  -- Ensure code uniqueness (avoid collision) by appending suffix if necessary
  -- (Make codes unique by updating duplicates using row_number)
  WITH duplicates AS (
    SELECT id, code, ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at, id) rn
    FROM public.municipalities
  )
  UPDATE public.municipalities m
  SET code = m.code || ('-' || d.rn::text)
  FROM duplicates d
  WHERE m.id = d.id AND d.rn > 1;

  RAISE NOTICE 'Municipalities sync completed.';
END
$$;
