-- ========================================================
-- Post-Restore Automation Script for Local Supabase/PostgreSQL
-- ========================================================

-- 1. Grant full schema and object permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;

-- 2. Turn all Views into Security Definer (security_invoker = false)
DO $$
DECLARE
    v RECORD;
BEGIN
    FOR v IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        BEGIN
            EXECUTE 'ALTER VIEW public."' || v.table_name || '" SET (security_invoker = false);';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;

-- 3. Disable Row Level Security & Add Permissive Fallback Policies for local access
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        BEGIN
            EXECUTE 'ALTER TABLE public."' || r.tablename || '" DISABLE ROW LEVEL SECURITY;';
            EXECUTE 'ALTER TABLE public."' || r.tablename || '" NO FORCE ROW LEVEL SECURITY;';
            EXECUTE 'DROP POLICY IF EXISTS allow_all_local ON public."' || r.tablename || '";';
            EXECUTE 'CREATE POLICY allow_all_local ON public."' || r.tablename || '" FOR ALL TO public USING (true) WITH CHECK (true);';
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
