
-- Remove the previous view; use column-level privileges instead
DROP VIEW IF EXISTS public.user_directory;

-- Replace the owner-only SELECT policy with a broad row policy;
-- column privileges below restrict which columns authenticated can read.
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Authenticated can read directory columns"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Revoke table-wide SELECT, grant only id + username at column level.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, username) ON public.profiles TO authenticated;

-- Preserve write privileges scoped by existing RLS policies.
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
