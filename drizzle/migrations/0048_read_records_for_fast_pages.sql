-- Precomputed page inputs (P1 · Fast pages). Written only by scheduled jobs with the service role; read by public pages with one query.
-- Every body is derived from data that is already publicly readable, so a public SELECT exposes nothing new.
CREATE TABLE public.read_records (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 300),
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 60),
  body jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 60),
  bytes integer NOT NULL DEFAULT 0
);
CREATE INDEX read_records_kind_computed_idx ON public.read_records (kind, computed_at);
GRANT SELECT ON public.read_records TO anon, authenticated;
GRANT ALL ON public.read_records TO service_role;
ALTER TABLE public.read_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Precomputed public page records are readable by everyone" ON public.read_records FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.read_records IS 'Precomputed public page inputs (site trait index, signals snapshot, rebrands, brand cards, ...). Derived only from publicly readable rows; written by scheduled jobs with the service role.';

-- The brand identity card looks up Google faces by family.
CREATE INDEX IF NOT EXISTS font_catalog_source_family_idx ON public.font_catalog (source, family);