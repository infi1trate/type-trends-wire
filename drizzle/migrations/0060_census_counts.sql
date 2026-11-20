CREATE TABLE public.census_counts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  census_key text NOT NULL CHECK (char_length(census_key) BETWEEN 1 AND 40),
  day date NOT NULL,
  count integer NOT NULL CHECK (count >= 0),
  base integer NOT NULL CHECK (base >= 0 AND count <= base),
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  story_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX census_counts_story_idx ON public.census_counts (story_id);
CREATE INDEX census_counts_key_idx ON public.census_counts (census_key, day DESC);
COMMENT ON TABLE public.census_counts IS 'E2g census: insert-only count each census story ran on (key, day, count, base, members with their quoted lines). The next census of that key compares with the latest row whose story is published.';
GRANT SELECT ON public.census_counts TO anon, authenticated;
GRANT ALL ON public.census_counts TO service_role;
ALTER TABLE public.census_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read census counts" ON public.census_counts FOR SELECT TO anon, authenticated USING (true);
CREATE FUNCTION public.census_counts_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'census_counts is insert-only';
END
$$;
CREATE TRIGGER census_counts_insert_only BEFORE UPDATE OR DELETE ON public.census_counts FOR EACH ROW EXECUTE FUNCTION public.census_counts_insert_only();