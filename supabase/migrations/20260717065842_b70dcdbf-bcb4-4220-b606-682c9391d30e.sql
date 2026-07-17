
CREATE TABLE public.site_tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_tables TO authenticated;
GRANT SELECT ON public.site_tables TO anon;
GRANT ALL ON public.site_tables TO service_role;
ALTER TABLE public.site_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their site tables"
  ON public.site_tables FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_tables.site_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_tables.site_id AND s.owner_id = auth.uid()));

CREATE POLICY "Anon read tables of published sites"
  ON public.site_tables FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_tables.site_id AND s.is_published = true));

CREATE POLICY "Authed read tables of published sites"
  ON public.site_tables FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_tables.site_id AND s.is_published = true));

CREATE TABLE public.site_rows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id uuid NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  table_id uuid NOT NULL REFERENCES public.site_tables(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX site_rows_table_id_idx ON public.site_rows(table_id);
CREATE INDEX site_rows_site_id_idx ON public.site_rows(site_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_rows TO authenticated;
GRANT SELECT ON public.site_rows TO anon;
GRANT ALL ON public.site_rows TO service_role;
ALTER TABLE public.site_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their site rows"
  ON public.site_rows FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_rows.site_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_rows.site_id AND s.owner_id = auth.uid()));

CREATE POLICY "Anon read rows of published sites"
  ON public.site_rows FOR SELECT
  TO anon
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_rows.site_id AND s.is_published = true));

CREATE POLICY "Authed read rows of published sites"
  ON public.site_rows FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sites s WHERE s.id = site_rows.site_id AND s.is_published = true));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_site_rows_updated_at
  BEFORE UPDATE ON public.site_rows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
