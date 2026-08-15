-- Fix runtime error: function round(double precision, integer) does not exist
-- We add a safe overload for round(dp, int) that casts via numeric and returns double precision
-- This avoids touching existing triggers/functions that already call round(x, 2) on double precision values

BEGIN;

-- Ensure we're in public schema
SET search_path = public;

-- Create a safe overload for round(double precision, integer)
CREATE OR REPLACE FUNCTION public.round(val double precision, digits integer)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
           WHEN val IS NULL OR digits IS NULL THEN NULL
           ELSE ROUND(val::numeric, digits)::double precision
         END
$$;

COMMENT ON FUNCTION public.round(double precision, integer) IS 'Overload to support rounding double precision with specified digits by casting to numeric first.';

COMMIT;