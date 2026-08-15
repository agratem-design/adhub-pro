
-- ============================================================
-- Migration: Fix size_id type mismatch and link properly
-- ============================================================

-- STEP 1: Drop existing size_id column from billboards if type mismatch
ALTER TABLE public.billboards DROP COLUMN IF EXISTS size_id CASCADE;

-- STEP 2: Add size_id column to billboards with correct type (bigint to match sizes.id)
ALTER TABLE public.billboards ADD COLUMN size_id BIGINT;
COMMENT ON COLUMN public.billboards.size_id IS 'Foreign key to sizes.id';

-- STEP 3: Add size_id column to pricing table if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'pricing' 
      AND column_name = 'size_id'
  ) THEN
    ALTER TABLE public.pricing ADD COLUMN size_id BIGINT;
    COMMENT ON COLUMN public.pricing.size_id IS 'Foreign key to sizes.id';
  END IF;
END $$;

-- STEP 4: Update billboards.size_id based on Size name match
UPDATE public.billboards b
SET size_id = s.id
FROM public.sizes s
WHERE TRIM(b."Size") = TRIM(s.name);

-- STEP 5: Update pricing.size_id based on size name match  
UPDATE public.pricing p
SET size_id = s.id
FROM public.sizes s
WHERE TRIM(p.size) = TRIM(s.name);

-- STEP 6: Add foreign key constraints
DO $$ BEGIN
  -- Add foreign key for billboards.size_id -> sizes.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_billboard_size'
  ) THEN
    ALTER TABLE public.billboards
    ADD CONSTRAINT fk_billboard_size 
    FOREIGN KEY (size_id) REFERENCES public.sizes(id) 
    ON DELETE SET NULL;
  END IF;

  -- Add foreign key for pricing.size_id -> sizes.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_pricing_size'
  ) THEN
    ALTER TABLE public.pricing
    ADD CONSTRAINT fk_pricing_size 
    FOREIGN KEY (size_id) REFERENCES public.sizes(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- STEP 7: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_billboards_size_id ON public.billboards(size_id);
CREATE INDEX IF NOT EXISTS idx_pricing_size_id ON public.pricing(size_id);
CREATE INDEX IF NOT EXISTS idx_sizes_name ON public.sizes(name);

-- STEP 8: Report results
DO $$ 
DECLARE
  billboards_linked INT;
  pricing_linked INT;
  billboards_total INT;
  pricing_total INT;
BEGIN
  SELECT COUNT(*) INTO billboards_linked FROM public.billboards WHERE size_id IS NOT NULL;
  SELECT COUNT(*) INTO billboards_total FROM public.billboards;
  SELECT COUNT(*) INTO pricing_linked FROM public.pricing WHERE size_id IS NOT NULL;
  SELECT COUNT(*) INTO pricing_total FROM public.pricing;
  
  RAISE NOTICE '✅ Migration complete!';
  RAISE NOTICE 'Billboards with size_id: % / %', billboards_linked, billboards_total;
  RAISE NOTICE 'Pricing rows with size_id: % / %', pricing_linked, pricing_total;
END $$;
