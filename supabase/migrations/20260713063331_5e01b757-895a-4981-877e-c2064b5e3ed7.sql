DROP POLICY IF EXISTS "Profiles readable public username" ON public.profiles;
REVOKE SELECT ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = lower(_username));
$$;

GRANT EXECUTE ON FUNCTION public.username_available(text) TO anon, authenticated;