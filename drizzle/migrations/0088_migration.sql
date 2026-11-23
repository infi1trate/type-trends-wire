-- D1 Part 3 · write only what changed.
-- Stored pages: a hash of the body, so an unchanged page is not rewritten (only its checked time moves).
ALTER TABLE public.read_records ADD COLUMN IF NOT EXISTS body_hash text CHECK (body_hash IS NULL OR char_length(body_hash) = 64);

-- Archive replay that writes only the rows that differ (the old function deletes and re-inserts a brand's whole archive history on
-- every post). Same lock, same expected-input check, same rows in the end.
CREATE OR REPLACE FUNCTION public.library_archive_replace_changed(p_domain text, p_expected jsonb, p_history jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE v_del_b integer := 0; v_ins_b integer := 0; v_del_e integer := 0; v_ins_e integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_domain, 0));
  IF public.library_archive_input(p_domain) IS DISTINCT FROM p_expected THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  WITH nb AS (
    SELECT x->>'page_type' AS page_type, x->>'viewport' AS viewport, x#>'{baseline,signals}' AS signals,
           (x#>>'{baseline,snapshot_id}')::bigint AS snapshot_id, (x#>>'{baseline,confirmed_at}')::timestamptz AS confirmed_at, x->'pending' AS pending
      FROM jsonb_array_elements(p_history->'baselines') x WHERE x->>'source' = 'wayback' AND x->>'domain' = p_domain
  ), d AS (
    DELETE FROM public.library_baselines b
     WHERE b.domain = p_domain AND b.source = 'wayback'
       AND NOT EXISTS (SELECT 1 FROM nb WHERE nb.page_type = b.page_type AND nb.viewport = b.viewport
                         AND nb.signals IS NOT DISTINCT FROM b.signals AND nb.snapshot_id IS NOT DISTINCT FROM b.snapshot_id
                         AND nb.confirmed_at IS NOT DISTINCT FROM b.confirmed_at AND nb.pending IS NOT DISTINCT FROM b.pending)
    RETURNING 1)
  SELECT count(*) INTO v_del_b FROM d;

  WITH nb AS (
    SELECT x->>'page_type' AS page_type, x->>'viewport' AS viewport, x#>'{baseline,signals}' AS signals,
           (x#>>'{baseline,snapshot_id}')::bigint AS snapshot_id, (x#>>'{baseline,confirmed_at}')::timestamptz AS confirmed_at, x->'pending' AS pending
      FROM jsonb_array_elements(p_history->'baselines') x WHERE x->>'source' = 'wayback' AND x->>'domain' = p_domain
  ), i AS (
    INSERT INTO public.library_baselines (domain, page_type, viewport, source, signals, snapshot_id, confirmed_at, pending)
    SELECT p_domain, nb.page_type, nb.viewport, 'wayback', nb.signals, nb.snapshot_id, nb.confirmed_at, nb.pending FROM nb
     WHERE NOT EXISTS (SELECT 1 FROM public.library_baselines b WHERE b.domain = p_domain AND b.source = 'wayback' AND b.page_type = nb.page_type AND b.viewport = nb.viewport)
    RETURNING 1)
  SELECT count(*) INTO v_ins_b FROM i;

  WITH ne AS (
    SELECT x->>'page_type' AS page_type, x->>'viewport' AS viewport, (x->>'effective_at')::timestamptz AS effective_at, x->>'type' AS type,
           (x->>'severity')::smallint AS severity, x->>'summary' AS summary, x->'before' AS before, x->'after' AS after,
           (x->>'prev_snapshot_id')::bigint AS prev_snapshot_id, (x->>'snapshot_id')::bigint AS snapshot_id
      FROM jsonb_array_elements(p_history->'events') x WHERE x->>'source' = 'wayback' AND x->>'domain' = p_domain
  ), d AS (
    DELETE FROM public.library_events e
     WHERE e.domain = p_domain AND e.source = 'wayback'
       AND NOT EXISTS (SELECT 1 FROM ne WHERE ne.page_type IS NOT DISTINCT FROM e.page_type AND ne.viewport IS NOT DISTINCT FROM e.viewport
                         AND ne.effective_at IS NOT DISTINCT FROM e.effective_at AND ne.type IS NOT DISTINCT FROM e.type AND ne.severity IS NOT DISTINCT FROM e.severity
                         AND ne.summary IS NOT DISTINCT FROM e.summary AND ne.before IS NOT DISTINCT FROM e.before AND ne.after IS NOT DISTINCT FROM e.after
                         AND ne.prev_snapshot_id IS NOT DISTINCT FROM e.prev_snapshot_id AND ne.snapshot_id IS NOT DISTINCT FROM e.snapshot_id)
    RETURNING 1)
  SELECT count(*) INTO v_del_e FROM d;

  WITH ne AS (
    SELECT x->>'page_type' AS page_type, x->>'viewport' AS viewport, (x->>'effective_at')::timestamptz AS effective_at, x->>'type' AS type,
           (x->>'severity')::smallint AS severity, x->>'summary' AS summary, x->'before' AS before, x->'after' AS after,
           (x->>'prev_snapshot_id')::bigint AS prev_snapshot_id, (x->>'snapshot_id')::bigint AS snapshot_id
      FROM jsonb_array_elements(p_history->'events') x WHERE x->>'source' = 'wayback' AND x->>'domain' = p_domain
  ), i AS (
    INSERT INTO public.library_events (domain, page_type, viewport, source, detected_at, effective_at, type, severity, summary, before, after, prev_snapshot_id, snapshot_id)
    SELECT p_domain, ne.page_type, ne.viewport, 'wayback', now(), ne.effective_at, ne.type, ne.severity, ne.summary, ne.before, ne.after, ne.prev_snapshot_id, ne.snapshot_id FROM ne
     WHERE NOT EXISTS (SELECT 1 FROM public.library_events e WHERE e.domain = p_domain AND e.source = 'wayback'
                         AND ne.page_type IS NOT DISTINCT FROM e.page_type AND ne.viewport IS NOT DISTINCT FROM e.viewport
                         AND ne.effective_at IS NOT DISTINCT FROM e.effective_at AND ne.type IS NOT DISTINCT FROM e.type AND ne.severity IS NOT DISTINCT FROM e.severity
                         AND ne.summary IS NOT DISTINCT FROM e.summary AND ne.before IS NOT DISTINCT FROM e.before AND ne.after IS NOT DISTINCT FROM e.after
                         AND ne.prev_snapshot_id IS NOT DISTINCT FROM e.prev_snapshot_id AND ne.snapshot_id IS NOT DISTINCT FROM e.snapshot_id)
    RETURNING 1)
  SELECT count(*) INTO v_ins_e FROM i;

  RETURN jsonb_build_object('ok', true, 'baselines_deleted', v_del_b, 'baselines_inserted', v_ins_b, 'events_deleted', v_del_e, 'events_inserted', v_ins_e);
END;
$function$;
REVOKE ALL ON FUNCTION public.library_archive_replace_changed(text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_archive_replace_changed(text, jsonb, jsonb) TO service_role;