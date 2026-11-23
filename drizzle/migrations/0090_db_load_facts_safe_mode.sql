CREATE TABLE public.db_safe_mode (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  is_on boolean NOT NULL,
  actor text NOT NULL CHECK (actor IN ('auto', 'owner')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300),
  reading jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.db_safe_mode TO service_role;
ALTER TABLE public.db_safe_mode ENABLE ROW LEVEL SECURITY;
CREATE INDEX db_safe_mode_actor_idx ON public.db_safe_mode (actor, id DESC);

CREATE TABLE public.db_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL CHECK (level IN ('warn', 'bad')),
  key text NOT NULL UNIQUE CHECK (char_length(key) BETWEEN 3 AND 120),
  line text NOT NULL CHECK (char_length(line) BETWEEN 3 AND 600),
  reading jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.db_alerts TO service_role;
ALTER TABLE public.db_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX db_alerts_at_idx ON public.db_alerts (at DESC);

CREATE TABLE public.db_load_samples (
  at timestamptz PRIMARY KEY DEFAULT now(),
  wal_bytes numeric NOT NULL,
  stats_reset timestamptz
);
GRANT ALL ON public.db_load_samples TO service_role;
ALTER TABLE public.db_load_samples ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.db_load_facts()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  w numeric; r timestamptz; last_at timestamptz;
  ago record; conns int; maxc int; big record; skipped int; wal_hour numeric := NULL; span_min numeric := NULL;
BEGIN
  SELECT s.wal_bytes, s.stats_reset INTO w, r FROM pg_stat_wal s;
  SELECT max(at) INTO last_at FROM public.db_load_samples;
  IF last_at IS NULL OR last_at < now() - interval '5 minutes' THEN
    BEGIN
      INSERT INTO public.db_load_samples (wal_bytes, stats_reset) VALUES (w, r);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  SELECT at, wal_bytes, stats_reset INTO ago FROM public.db_load_samples
    WHERE at <= now() - interval '50 minutes' AND at >= now() - interval '2 hours' ORDER BY at DESC LIMIT 1;
  IF ago.at IS NOT NULL AND ago.stats_reset IS NOT DISTINCT FROM r AND w >= ago.wal_bytes THEN
    span_min := extract(epoch FROM now() - ago.at) / 60.0;
    wal_hour := (w - ago.wal_bytes) * 60.0 / span_min;
  END IF;
  SELECT count(*) INTO conns FROM pg_stat_activity WHERE backend_type = 'client backend';
  maxc := current_setting('max_connections')::int;
  SELECT job, ms, at INTO big FROM public.job_runs
    WHERE phase = 'finish' AND at > now() - interval '1 hour' AND ms IS NOT NULL ORDER BY ms DESC LIMIT 1;
  SELECT count(*) INTO skipped FROM public.job_runs
    WHERE phase = 'finish' AND at > now() - interval '1 hour' AND note LIKE 'skipped: database slow%';
  RETURN jsonb_build_object(
    'at', now(),
    'connections', conns,
    'max_connections', maxc,
    'wal_bytes_total', w,
    'wal_since', r,
    'wal_bytes_hour', round(wal_hour),
    'wal_span_min', round(span_min, 1),
    'biggest_job', CASE WHEN big.job IS NULL THEN NULL ELSE jsonb_build_object('job', big.job, 'ms', big.ms, 'at', big.at) END,
    'skipped_slow_hour', skipped
  );
END;
$$;
REVOKE ALL ON FUNCTION public.db_load_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_load_facts() TO anon, authenticated, service_role;