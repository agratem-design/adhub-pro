-- Create a function to sync the billboards sequence with the actual max ID
CREATE OR REPLACE FUNCTION public.setval_billboards_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM setval('billboards_id_seq', COALESCE((SELECT MAX("ID") FROM billboards), 0), true);
END;
$$;