-- Fix: create Contract RLS policies using distinct dollar-quoting tags

ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Contract'
      AND policyname = 'Users with contracts permission can view contracts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users with contracts permission can view contracts"
      ON public."Contract"
      FOR SELECT
      TO authenticated
      USING (public.has_permission(auth.uid(), 'contracts'))
    $pol$;
  END IF;
END $do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Contract'
      AND policyname = 'Users with contracts permission can update contracts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users with contracts permission can update contracts"
      ON public."Contract"
      FOR UPDATE
      TO authenticated
      USING (public.has_permission(auth.uid(), 'contracts'))
      WITH CHECK (public.has_permission(auth.uid(), 'contracts'))
    $pol$;
  END IF;
END $do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Contract'
      AND policyname = 'Users with contracts permission can create contracts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users with contracts permission can create contracts"
      ON public."Contract"
      FOR INSERT
      TO authenticated
      WITH CHECK (public.has_permission(auth.uid(), 'contracts'))
    $pol$;
  END IF;
END $do$;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Contract'
      AND policyname = 'Users with contracts permission can delete contracts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users with contracts permission can delete contracts"
      ON public."Contract"
      FOR DELETE
      TO authenticated
      USING (public.has_permission(auth.uid(), 'contracts'))
    $pol$;
  END IF;
END $do$;