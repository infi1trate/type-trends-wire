-- Phase 6A: F7 vibe map storage and weekly chart cards. Derived data only (tag-space coordinates, chart numbers); no images.
CREATE TABLE public.vibe_maps (
  quarter text PRIMARY KEY CHECK (quarter ~ '^\d{4}Q[1-4]$'),
  run_id bigint NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  model jsonb NOT NULL
);
GRANT SELECT ON public.vibe_maps TO anon, authenticated;
GRANT ALL ON public.vibe_maps TO service_role;
ALTER TABLE public.vibe_maps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.vibe_maps FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.vibe_clusters (
  quarter text NOT NULL CHECK (quarter ~ '^\d{4}Q[1-4]$'),
  cluster smallint NOT NULL CHECK (cluster BETWEEN 0 AND 15),
  name text NOT NULL CHECK (char_length(name) <= 120),
  run_id bigint NOT NULL,
  stats jsonb NOT NULL,
  PRIMARY KEY (quarter, cluster)
);
GRANT SELECT ON public.vibe_clusters TO anon, authenticated;
GRANT ALL ON public.vibe_clusters TO service_role;
ALTER TABLE public.vibe_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.vibe_clusters FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.vibe_points (
  quarter text NOT NULL CHECK (quarter ~ '^\d{4}Q[1-4]$'),
  domain text NOT NULL,
  sector text NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  cluster smallint NOT NULL CHECK (cluster BETWEEN 0 AND 15),
  tags text[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 40),
  current boolean NOT NULL DEFAULT false,
  run_id bigint NOT NULL,
  PRIMARY KEY (quarter, domain)
);
CREATE INDEX vibe_points_current_idx ON public.vibe_points (current, sector);
GRANT SELECT ON public.vibe_points TO anon, authenticated;
GRANT ALL ON public.vibe_points TO service_role;
ALTER TABLE public.vibe_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.vibe_points FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.chart_cards (
  week text PRIMARY KEY CHECK (week ~ '^\d{4}-W\d{2}$'),
  run_id bigint NOT NULL,
  trait text NOT NULL CHECK (char_length(trait) <= 200),
  origin text NOT NULL CHECK (origin IN ('call', 'alert')),
  model jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.chart_cards TO anon, authenticated;
GRANT ALL ON public.chart_cards TO service_role;
ALTER TABLE public.chart_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.chart_cards FOR SELECT TO anon, authenticated USING (true);