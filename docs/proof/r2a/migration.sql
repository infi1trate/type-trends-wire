ALTER TABLE public.library_sites ADD COLUMN panel_since timestamptz;
UPDATE public.library_sites s SET panel_since = COALESCE((SELECT min(captured_at) FROM public.library_snapshots p WHERE p.domain = s.domain), s.added_at, now()) WHERE s.panel_since IS NULL;
CREATE INDEX library_sites_panel_since_idx ON public.library_sites (panel_since);
CREATE TABLE public.panel_steps (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  brands_before integer NOT NULL,
  brands_after integer NOT NULL,
  by_sector jsonb NOT NULL DEFAULT '{}'::jsonb,
  who text NOT NULL,
  domains text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.panel_steps TO anon, authenticated;
GRANT ALL ON public.panel_steps TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.panel_steps_id_seq TO service_role;
ALTER TABLE public.panel_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.panel_steps FOR SELECT TO anon, authenticated USING (true);