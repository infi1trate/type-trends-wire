CREATE OR REPLACE FUNCTION public.records_sweep_facts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
    'at', f.at,
    'ok', f.ok,
    'ms', f.ms,
    'note', left(coalesce(f.note, ''), 200),
    'written', CASE WHEN jsonb_typeof(f.detail->'written') = 'number' THEN f.detail->'written' ELSE NULL END,
    'retimed', CASE WHEN jsonb_typeof(f.detail->'retimed') = 'number' THEN f.detail->'retimed' ELSE NULL END,
    'skipped', CASE WHEN jsonb_typeof(f.detail->'skipped') = 'number' THEN f.detail->'skipped' ELSE NULL END,
    'timed_out', CASE WHEN jsonb_typeof(f.detail->'timed_out') = 'boolean' THEN f.detail->'timed_out' ELSE NULL END,
    'error_steps', CASE WHEN jsonb_typeof(f.detail->'errors') = 'array' THEN (SELECT coalesce(jsonb_agg(split_part(e, ':', 1)), '[]'::jsonb) FROM jsonb_array_elements_text(f.detail->'errors') e) ELSE NULL END
  ) END
  FROM (SELECT 1) one
  LEFT JOIN LATERAL (
    SELECT id, at, ok, ms, note, detail FROM public.job_runs
    WHERE job = 'records-refresh' AND phase = 'finish'
    ORDER BY id DESC LIMIT 1
  ) f ON true
$$;
COMMENT ON FUNCTION public.records_sweep_facts() IS 'Public health: the stored-pages sweep''s last finish row (counts and step names only).';
REVOKE ALL ON FUNCTION public.records_sweep_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.records_sweep_facts() TO anon, authenticated, service_role;