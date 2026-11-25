CREATE TABLE public.library_structure_records (
  domain text NOT NULL,
  viewport text NOT NULL,
  quarter text NOT NULL,
  snapshot_id bigint NOT NULL,
  source text NOT NULL,
  captured_at timestamptz NOT NULL,
  structure_read boolean NOT NULL DEFAULT false,
  record jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  derived_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, viewport, quarter)
);
CREATE INDEX library_structure_records_quarter_idx ON public.library_structure_records (quarter, viewport);
CREATE INDEX library_structure_records_captured_idx ON public.library_structure_records (captured_at) WHERE structure_read;
GRANT SELECT ON public.library_structure_records TO anon, authenticated;
GRANT ALL ON public.library_structure_records TO service_role;
ALTER TABLE public.library_structure_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_structure_records FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.library_structure_series (
  signal text NOT NULL,
  viewport text NOT NULL,
  scope text NOT NULL,
  quarter text NOT NULL,
  n_read integer NOT NULL DEFAULT 0,
  n_yes integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal, viewport, scope, quarter)
);
CREATE INDEX library_structure_series_scope_idx ON public.library_structure_series (scope, quarter);
GRANT SELECT ON public.library_structure_series TO anon, authenticated;
GRANT ALL ON public.library_structure_series TO service_role;
ALTER TABLE public.library_structure_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_structure_series FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.library_structure_state (
  id integer PRIMARY KEY DEFAULT 1,
  last_snapshot_id bigint NOT NULL DEFAULT 0,
  series_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.library_structure_state TO service_role;
ALTER TABLE public.library_structure_state ENABLE ROW LEVEL SECURITY;