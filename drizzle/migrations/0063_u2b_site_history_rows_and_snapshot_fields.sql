-- U2b · Part A. Additive only: a materialized copy of library_site_history (refreshed by the existing history refresh path), a public
-- read facade, a one-detoast projection view over library_snapshots for the integrity reads, and an index for the carousel lookup.

CREATE MATERIALIZED VIEW public.library_site_history_mat AS SELECT * FROM public.library_site_history WITH DATA;
CREATE UNIQUE INDEX library_site_history_mat_key ON public.library_site_history_mat (domain, quarter);
CREATE INDEX library_site_history_mat_now_idx ON public.library_site_history_mat (now);
CREATE INDEX library_site_history_mat_sector_idx ON public.library_site_history_mat (sector, quarter);
REVOKE ALL ON public.library_site_history_mat FROM anon, authenticated;
GRANT ALL ON public.library_site_history_mat TO service_role;

-- Owner-rights facade (same pattern as library_history_share over library_history_share_mat): visitors read the stored rows only.
CREATE VIEW public.library_site_history_rows AS SELECT * FROM public.library_site_history_mat;
REVOKE ALL ON public.library_site_history_rows FROM anon, authenticated;
GRANT SELECT ON public.library_site_history_rows TO anon, authenticated;
GRANT ALL ON public.library_site_history_rows TO service_role;

-- The per-view refresh (API path) learns the new view; it is refreshed concurrently so readers never block.
CREATE OR REPLACE FUNCTION public.library_history_refresh_view(p_view text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t0 timestamptz;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('library_site_history_mat','library_history_share_mat','library_signal_series_mat','library_css_series_mat','library_font_series_mat','library_tag_series_mat') THEN
  RAISE EXCEPTION 'unknown history view' USING ERRCODE='22023';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
  RETURN jsonb_build_object('ok',false,'skipped',true,'ms',0);
 END IF;
 t0 := clock_timestamp();
 IF p_view = 'library_site_history_mat' THEN
  EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', p_view);
 ELSE
  EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', p_view);
 END IF;
 RETURN jsonb_build_object('ok',true,'skipped',false,'ms',round(extract(epoch FROM clock_timestamp()-t0)*1000));
END; $function$;

-- The scheduled job: same dirty flag and schedule; the site rows first (pages read them), concurrently.
CREATE OR REPLACE PROCEDURE public.library_history_refresh_job()
 LANGUAGE plpgsql
AS $procedure$
DECLARE
 v text;
 ok boolean;
 busy boolean;
 err text;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
  RAISE NOTICE 'library history refresh: another refresh holds the lock';
  RETURN;
 END IF;
 UPDATE public.library_history_control SET dirty=false, refresh_started_at=now() WHERE id=1 AND dirty;
 IF NOT FOUND THEN RETURN; END IF;
 COMMIT;
 FOREACH v IN ARRAY ARRAY['library_site_history_mat','library_signal_series_mat','library_css_series_mat','library_font_series_mat','library_tag_series_mat','library_history_share_mat'] LOOP
  ok := true; busy := false; err := NULL;
  BEGIN
   IF pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
    SET LOCAL lock_timeout = '20s';
    IF v = 'library_site_history_mat' THEN
     EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v);
    ELSE
     EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', v);
    END IF;
   ELSE
    ok := false; busy := true;
   END IF;
  EXCEPTION WHEN OTHERS THEN
   ok := false; err := SQLERRM;
  END;
  IF NOT ok THEN
   UPDATE public.library_history_control SET dirty=true WHERE id=1;
   COMMIT;
   IF busy THEN
    RAISE NOTICE 'library history refresh: stopped at % (another refresh holds the lock)', v;
    RETURN;
   END IF;
   RAISE EXCEPTION 'library history refresh failed at %: %', v, err;
  END IF;
  COMMIT;
 END LOOP;
 UPDATE public.library_history_control SET refreshed_at=now() WHERE id=1;
 COMMIT;
END; $procedure$;

-- One detoast per capture: a PL/pgSQL argument is detoasted once on entry, so the integrity fields cost one read of `signals`
-- instead of one per JSON path.
CREATE OR REPLACE FUNCTION public.library_snapshot_check_fields(s jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO ''
AS $function$
BEGIN
 RETURN jsonb_build_object(
  'rendered', s #> '{type,rendered}', 'color', s -> 'color', 'layout', s -> 'layout', 'h1', s #> '{lexicon,h1}',
  'nav', s -> 'nav', 'prices', s -> 'prices', 'tech', s -> 'tech', 'ai_pricing', s -> 'ai_pricing');
END; $function$;
GRANT EXECUTE ON FUNCTION public.library_snapshot_check_fields(jsonb) TO anon, authenticated, service_role;

CREATE VIEW public.library_snapshot_fields WITH (security_invoker = true) AS
 SELECT id, domain, page_type, viewport, source, captured_at,
  signals -> 'layout' -> 'hero_carousel' AS hero_carousel,
  public.library_snapshot_check_fields(signals) AS check_fields
 FROM public.library_snapshots;
REVOKE ALL ON public.library_snapshot_fields FROM anon, authenticated;
GRANT SELECT ON public.library_snapshot_fields TO anon, authenticated;
GRANT ALL ON public.library_snapshot_fields TO service_role;

-- The carousel lookup ("live captures since X with a carousel") reads this instead of detoasting every live capture.
CREATE INDEX library_snapshots_carousel_idx ON public.library_snapshots (((signals -> 'layout') -> 'hero_carousel'), source, captured_at);