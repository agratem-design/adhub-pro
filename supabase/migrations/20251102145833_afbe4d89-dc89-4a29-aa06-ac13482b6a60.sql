-- Clean orphaned rows to satisfy FK
DELETE FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = ur.user_id
);

-- Drop existing FK and recreate as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;