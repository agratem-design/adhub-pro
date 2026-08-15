const { execSync } = require('child_process');

const sql = `
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
`;

try {
  execSync('docker exec -i supabase_db_adhub_local_supabase psql -U postgres -d postgres', {
    input: sql,
    stdio: 'inherit',
  });
  console.log('✅ Permissions and RLS setup completed successfully!');
} catch (e) {
  console.error('Error applying permissions:', e);
}
