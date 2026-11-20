CREATE TABLE public.outside_series (
  source text NOT NULL CHECK (source ~ '^[a-z]{2,24}$'),
  key text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 214),
  metric text NOT NULL CHECK (metric ~ '^[a-z][a-z_]{1,39}$'),
  period_end date NOT NULL,
  value bigint NOT NULL CHECK (value >= 0),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  topic text NOT NULL CHECK (topic ~ '^[a-z0-9][a-z0-9_-]{0,39}$'),
  captured_at timestamptz NOT NULL,
  run_id text NOT NULL CHECK (char_length(run_id) BETWEEN 1 AND 120),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source, key, metric, period_end)
);
CREATE INDEX outside_series_captured_idx ON public.outside_series (captured_at DESC);
CREATE INDEX outside_series_run_idx ON public.outside_series (run_id);
COMMENT ON TABLE public.outside_series IS 'Leading indicators: daily public numbers from outside the brands'' sites (npm weekly downloads, GitHub stars/forks/open issues). One row per source+key+metric+period_end; a repeat post replaces the value. Written only by /api/public/ingest-series.';

GRANT SELECT ON public.outside_series TO anon, authenticated;
GRANT ALL ON public.outside_series TO service_role;
ALTER TABLE public.outside_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leading indicators are public" ON public.outside_series FOR SELECT TO anon, authenticated USING (true);

CREATE VIEW public.outside_series_weekly WITH (security_invoker = true) AS
  SELECT DISTINCT ON (source, key, metric, date_trunc('week', period_end::timestamp))
    source, key, metric, period_end, value, label, topic, captured_at
  FROM public.outside_series
  ORDER BY source, key, metric, date_trunc('week', period_end::timestamp), period_end DESC;
GRANT SELECT ON public.outside_series_weekly TO anon, authenticated, service_role;

CREATE FUNCTION public.outside_series_store(p_points jsonb, p_run_id text, p_captured_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new integer; v_rep integer;
BEGIN
  WITH up AS (
    INSERT INTO public.outside_series (source, key, metric, period_end, value, label, topic, captured_at, run_id)
    SELECT p->>'source', p->>'key', p->>'metric', (p->>'period_end')::date, (p->>'value')::bigint, p->>'label', p->>'topic', p_captured_at, p_run_id
    FROM jsonb_array_elements(p_points) AS p
    ON CONFLICT (source, key, metric, period_end) DO UPDATE
      SET value = EXCLUDED.value, label = EXCLUDED.label, topic = EXCLUDED.topic, captured_at = EXCLUDED.captured_at, run_id = EXCLUDED.run_id, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT count(*) FILTER (WHERE inserted), count(*) FILTER (WHERE NOT inserted) INTO v_new, v_rep FROM up;
  RETURN jsonb_build_object('inserted', v_new, 'replaced', v_rep);
END
$$;
REVOKE ALL ON FUNCTION public.outside_series_store(jsonb, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.outside_series_store(jsonb, text, timestamptz) TO service_role;