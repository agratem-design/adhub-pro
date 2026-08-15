CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT email FROM public.profiles WHERE LOWER(username) = LOWER(p_username) LIMIT 1;
$func$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
