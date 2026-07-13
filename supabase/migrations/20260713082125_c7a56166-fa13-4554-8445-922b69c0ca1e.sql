
-- 1. Restrict profiles SELECT to owner only
DROP POLICY IF EXISTS "Profiles readable by anyone signed in" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2. Ensure username uniqueness (enforced by DB instead of RPC check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_unique' AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_unique UNIQUE (username);
  END IF;
END $$;

-- 3. Public directory view exposing only id + username (no PII).
-- security_invoker = off makes the view bypass RLS on profiles, which is
-- intended: id + username are the only columns exposed.
DROP VIEW IF EXISTS public.user_directory;
CREATE VIEW public.user_directory
  WITH (security_invoker = off) AS
  SELECT id, username FROM public.profiles;

GRANT SELECT ON public.user_directory TO authenticated;

-- 4. Drop the SECURITY DEFINER function flagged by the linter.
DROP FUNCTION IF EXISTS public.username_available(text);
