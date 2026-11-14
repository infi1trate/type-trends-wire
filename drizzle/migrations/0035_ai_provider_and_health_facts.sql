ALTER TABLE public.ai_usage ADD COLUMN provider text;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_provider_check CHECK (provider IS NULL OR provider IN ('lovable','google'));
COMMENT ON COLUMN public.ai_usage.provider IS 'AI provider that ran the call: lovable (gateway) or google (AI Studio). NULL rows predate provider tracking and ran on lovable.';

ALTER TABLE public.library_snapshots ADD COLUMN received_at timestamptz;
ALTER TABLE public.library_snapshots ALTER COLUMN received_at SET DEFAULT now();
COMMENT ON COLUMN public.library_snapshots.received_at IS 'When the terminal stored the snapshot (NULL before tracking). Used for job health only.';
CREATE INDEX library_snapshots_source_received_idx ON public.library_snapshots(source, received_at);

CREATE FUNCTION public.health_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object(
  'now', now(),
  'ingest', (SELECT coalesce(jsonb_object_agg(t.job, t.x), '{}'::jsonb) FROM (
      SELECT r.job, jsonb_build_object(
        'last_run_at', max(r.finished_at),
        'last_ok_at', max(r.finished_at) FILTER (WHERE r.ok),
        'last_ok', (array_agg(r.ok ORDER BY r.finished_at DESC))[1],
        'failures_since_ok', count(*) FILTER (WHERE NOT r.ok AND r.finished_at > coalesce((SELECT max(o.finished_at) FROM public.ingest_runs o WHERE o.job = r.job AND o.ok), '-infinity'::timestamptz))) AS x
      FROM public.ingest_runs r WHERE r.job IN ('ingest-wire','ingest-gfonts') AND r.finished_at > now() - interval '30 days' GROUP BY r.job) t),
  'library_check_at', (SELECT max(s.captured_at) FROM public.library_snapshots s WHERE s.source = 'live' AND (s.run_id LIKE 'lib-check-%' OR s.run_id LIKE 'lib-full-%')),
  'library_full_at', (SELECT max(s.captured_at) FROM public.library_snapshots s WHERE s.source = 'live' AND s.run_id LIKE 'lib-full-%'),
  'wayback_received_at', (SELECT greatest(max(s.received_at), max(CASE WHEN s.run_id ~ '^wb-[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN to_date(substring(s.run_id from 4 for 10), 'YYYY-MM-DD')::timestamptz END)) FROM public.library_snapshots s WHERE s.source = 'wayback'),
  'crawl_runs', (SELECT coalesce(jsonb_agg(c.x ORDER BY c.started_at DESC), '[]'::jsonb) FROM (
      SELECT cr.started_at, jsonb_build_object('status', cr.status, 'started_at', cr.started_at, 'finished_at', cr.finished_at,
        'ok', (SELECT sum((e.v->>'ok')::numeric) FROM jsonb_each(coalesce(cr.stats, '{}'::jsonb)) e(k, v) WHERE jsonb_typeof(e.v) = 'object' AND jsonb_typeof(e.v->'ok') = 'number' AND jsonb_typeof(e.v->'tried') = 'number'),
        'tried', (SELECT sum((e.v->>'tried')::numeric) FROM jsonb_each(coalesce(cr.stats, '{}'::jsonb)) e(k, v) WHERE jsonb_typeof(e.v) = 'object' AND jsonb_typeof(e.v->'ok') = 'number' AND jsonb_typeof(e.v->'tried') = 'number')) AS x
      FROM public.crawl_runs cr ORDER BY cr.started_at DESC LIMIT 8) c),
  'forecast_runs', (SELECT coalesce(jsonb_agg(f.x ORDER BY f.id DESC), '[]'::jsonb) FROM (SELECT fr.id, jsonb_build_object('status', fr.status, 'computed_at', fr.computed_at) AS x FROM public.forecast_runs fr ORDER BY fr.id DESC LIMIT 8) f),
  'ai_jobs', (SELECT jsonb_build_object('pending', count(*) FILTER (WHERE j.status = 'pending'), 'oldest_pending_at', min(j.created_at) FILTER (WHERE j.status = 'pending'), 'last_done_at', max(j.done_at) FILTER (WHERE j.status = 'done'), 'last_activity_at', greatest(max(j.done_at), max(j.claimed_at)), 'paused', (SELECT coalesce(bool_or(c.paused), false) FROM public.library_ai_control c)) FROM public.library_ai_jobs j),
  'ai_interrupted_24h', (SELECT count(*) FROM public.ai_usage u WHERE u.created_at > now() - interval '24 hours' AND u.kind IN ('pricing','changelog','product') AND u.error IN ('unknown_outcome','run_deadline')),
  'render_queue', (SELECT jsonb_build_object('pending', count(*) FILTER (WHERE q.status = 'pending'), 'oldest_pending_at', min(q.requested_at) FILTER (WHERE q.status = 'pending'), 'last_done_at', max(q.done_at)) FROM public.crawl_requests q),
  'bluesky_window_end', (SELECT max(d.window_end) FROM public.discourse_counts d WHERE d.source = 'bluesky'),
  'taste_refreshed_at', (SELECT greatest((SELECT max(u.updated_at) FROM public.font_usage u), (SELECT max(t.updated_at) FROM public.color_tickers t))),
  'brief', (SELECT jsonb_build_object('week', b.week, 'created_at', b.created_at, 'card_at', (SELECT cc.created_at FROM public.chart_cards cc WHERE cc.week = b.week)) FROM public.weekly_briefs b ORDER BY b.week DESC LIMIT 1)
);
$$;
REVOKE ALL ON FUNCTION public.health_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.health_facts() TO anon, authenticated, service_role;