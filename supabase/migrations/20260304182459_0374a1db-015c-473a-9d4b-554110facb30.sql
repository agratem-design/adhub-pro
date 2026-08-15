
-- Drop permissive public read policies on Contract table
DROP POLICY IF EXISTS "Allow public read access to contracts" ON public."Contract";
DROP POLICY IF EXISTS "Enable read access for all users" ON public."Contract";

-- Create authenticated-only read policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'Contract' 
    AND schemaname = 'public' 
    AND policyname = 'Authenticated users read contracts'
  ) THEN
    CREATE POLICY "Authenticated users read contracts"
      ON public."Contract" FOR SELECT
      TO authenticated USING (true);
  END IF;
END $$;
