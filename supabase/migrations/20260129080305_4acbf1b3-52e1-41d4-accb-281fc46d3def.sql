-- Fix has_permission function to read from roles table instead of deprecated user_permissions
-- Cast app_role to text for comparison with roles.name (which is text)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role::text = r.name
    WHERE ur.user_id = _user_id 
      AND r.permissions @> ARRAY[_permission]::text[]
  )
$$;