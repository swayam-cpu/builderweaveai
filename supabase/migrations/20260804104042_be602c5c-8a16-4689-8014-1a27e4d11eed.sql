ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS files jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'single';