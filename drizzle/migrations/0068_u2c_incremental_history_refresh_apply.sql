-- U2c · the history refresh becomes incremental. Additive: a per-domain dirty set written by triggers, a stored table for the site
-- history rows (replaced per domain by the scheduled job), a run log, per-view refresh state, a stored copy of the integrity fields,
-- and new bodies for the scheduled job and the public history facts. The aggregate series are refreshed CONCURRENTLY on a cadence.

-- 1 · The dirty set: one row per domain whose stored history rows are behind, with when it first became dirty (dirty_at) and a
--     mark that every later write bumps, so the job only clears a domain whose mark it saw (no write between read and clear is lost).
CREATE SEQUENCE public.library_history_mark_seq;
CREATE TABLE public.library_history_dirty_domains (
  domain text PRIMARY KEY,
  dirty_at timestamptz NOT NULL DEFAULT now(),
  mark bigint NOT NULL DEFAULT nextval('public.library_history_mark_seq')
);
CREATE INDEX library_history_dirty_domains_at_idx ON public.library_history_dirty_domains (dirty_at, domain);
REVOKE ALL ON public.library_history_dirty_domains FROM anon, authenticated;
GRANT ALL ON public.library_history_dirty_domains TO service_role;
ALTER TABLE public.library_history_dirty_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SEQUENCE public.library_history_mark_seq FROM anon, authenticated;
GRANT ALL ON SEQUENCE public.library_history_mark_seq TO service_role;

CREATE FUNCTION public.library_history_mark(p_domains text[])
 RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path TO '' AS $$
  WITH m AS (
    INSERT INTO public.library_history_dirty_domains (domain)
    SELECT DISTINCT d FROM unnest(p_domains) d WHERE d IS NOT NULL
    ON CONFLICT (domain) DO UPDATE SET mark = nextval('public.library_history_mark_seq')
    RETURNING 1)
  SELECT count(*)::integer FROM m;
$$;
REVOKE ALL ON FUNCTION public.library_history_mark(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_history_mark(text[]) TO service_role;

-- 2 · The stored integrity fields (U2b's capture fields read built them per row from `signals`): written once per capture by trigger.
CREATE TABLE public.library_snapshot_check_store (
  snapshot_id bigint PRIMARY KEY REFERENCES public.library_snapshots(id) ON DELETE CASCADE,
  check_fields jsonb NOT NULL
);
GRANT SELECT ON public.library_snapshot_check_store TO anon, authenticated;
GRANT ALL ON public.library_snapshot_check_store TO service_role;
ALTER TABLE public.library_snapshot_check_store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Check fields are public like the captures they come from" ON public.library_snapshot_check_store FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.library_snapshot_check_store (snapshot_id, check_fields)
  SELECT s.id, public.library_snapshot_check_fields(s.signals) FROM public.library_snapshots s;

-- 3 · Triggers: captures, tags and site rows mark their domains (home/desktop captures only: the history rows read nothing else);
--     captures also store their integrity fields. Statement-level with transition tables: one upsert per statement.
CREATE FUNCTION public.library_snapshots_derive_ins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.library_snapshot_check_store (snapshot_id, check_fields)
    SELECT n.id, public.library_snapshot_check_fields(n.signals) FROM n ON CONFLICT (snapshot_id) DO NOTHING;
  PERFORM public.library_history_mark(ARRAY(SELECT DISTINCT n.domain FROM n WHERE n.page_type = 'home' AND n.viewport = 'desktop'));
  RETURN NULL;
END $$;
CREATE FUNCTION public.library_snapshots_derive_upd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.library_snapshot_check_store (snapshot_id, check_fields)
    SELECT n.id, public.library_snapshot_check_fields(n.signals) FROM n
    ON CONFLICT (snapshot_id) DO UPDATE SET check_fields = EXCLUDED.check_fields;
  PERFORM public.library_history_mark(ARRAY(
    SELECT n.domain FROM n WHERE n.page_type = 'home' AND n.viewport = 'desktop'
    UNION SELECT o.domain FROM o WHERE o.page_type = 'home' AND o.viewport = 'desktop'));
  RETURN NULL;
END $$;
CREATE FUNCTION public.library_snapshots_derive_del() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.library_history_mark(ARRAY(SELECT DISTINCT o.domain FROM o WHERE o.page_type = 'home' AND o.viewport = 'desktop'));
  RETURN NULL;
END $$;
CREATE FUNCTION public.library_tags_mark_new() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM public.library_history_mark(ARRAY(SELECT DISTINCT n.domain FROM n)); RETURN NULL; END $$;
CREATE FUNCTION public.library_tags_mark_old() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM public.library_history_mark(ARRAY(SELECT DISTINCT o.domain FROM o)); RETURN NULL; END $$;
CREATE FUNCTION public.library_sites_mark_ins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN PERFORM public.library_history_mark(ARRAY(SELECT n.domain FROM n)); RETURN NULL; END $$;
-- Sites are updated on every capture (last_snapshot_at); only a sector or active change alters the history rows.
CREATE FUNCTION public.library_sites_mark_upd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.library_history_mark(ARRAY(
    SELECT n.domain FROM n JOIN o USING (domain) WHERE n.sector IS DISTINCT FROM o.sector OR n.active IS DISTINCT FROM o.active));
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.library_snapshots_derive_ins(), public.library_snapshots_derive_upd(), public.library_snapshots_derive_del(),
  public.library_tags_mark_new(), public.library_tags_mark_old(), public.library_sites_mark_ins(), public.library_sites_mark_upd() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER library_snapshots_derive_ins AFTER INSERT ON public.library_snapshots REFERENCING NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_snapshots_derive_ins();
CREATE TRIGGER library_snapshots_derive_upd AFTER UPDATE ON public.library_snapshots REFERENCING OLD TABLE AS o NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_snapshots_derive_upd();
CREATE TRIGGER library_snapshots_derive_del AFTER DELETE ON public.library_snapshots REFERENCING OLD TABLE AS o FOR EACH STATEMENT EXECUTE FUNCTION public.library_snapshots_derive_del();
CREATE TRIGGER library_tags_mark_ins AFTER INSERT ON public.library_tags REFERENCING NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_tags_mark_new();
CREATE TRIGGER library_tags_mark_upd AFTER UPDATE ON public.library_tags REFERENCING NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_tags_mark_new();
CREATE TRIGGER library_tags_mark_del AFTER DELETE ON public.library_tags REFERENCING OLD TABLE AS o FOR EACH STATEMENT EXECUTE FUNCTION public.library_tags_mark_old();
CREATE TRIGGER library_sites_mark_ins AFTER INSERT ON public.library_sites REFERENCING NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_sites_mark_ins();
CREATE TRIGGER library_sites_mark_upd AFTER UPDATE ON public.library_sites REFERENCING OLD TABLE AS o NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION public.library_sites_mark_upd();

-- The capture fields view reads the stored fields (falling back to building them for a row without one). Same columns.
CREATE OR REPLACE VIEW public.library_snapshot_fields WITH (security_invoker = true) AS
 SELECT s.id, s.domain, s.page_type, s.viewport, s.source, s.captured_at,
  s.signals -> 'layout' -> 'hero_carousel' AS hero_carousel,
  COALESCE(c.check_fields, public.library_snapshot_check_fields(s.signals)) AS check_fields
 FROM public.library_snapshots s LEFT JOIN public.library_snapshot_check_store c ON c.snapshot_id = s.id;

-- 4 · The stored site history rows: a table with the materialized copy's columns, replaced per domain. Readers keep the same facade.
CREATE TABLE public.library_site_history_store (LIKE public.library_site_history_mat);
ALTER TABLE public.library_site_history_store ADD PRIMARY KEY (domain, quarter);
CREATE INDEX library_site_history_store_now_idx ON public.library_site_history_store (now);
CREATE INDEX library_site_history_store_sector_idx ON public.library_site_history_store (sector, quarter);
REVOKE ALL ON public.library_site_history_store FROM anon, authenticated;
GRANT ALL ON public.library_site_history_store TO service_role;
ALTER TABLE public.library_site_history_store ENABLE ROW LEVEL SECURITY;
INSERT INTO public.library_site_history_store SELECT * FROM public.library_site_history;
CREATE OR REPLACE VIEW public.library_site_history_rows AS SELECT * FROM public.library_site_history_store;
COMMENT ON MATERIALIZED VIEW public.library_site_history_mat IS 'DEPRECATED: replaced by library_site_history_store (per-domain rows written by library_history_refresh_job); no longer refreshed on the schedule.';

-- 5 · Run log and per-view state.
CREATE TABLE public.library_history_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ms integer NOT NULL,
  domains_done integer NOT NULL DEFAULT 0,
  domains_left integer NOT NULL DEFAULT 0,
  rows_written integer NOT NULL DEFAULT 0,
  domain_ms jsonb NOT NULL DEFAULT '[]'::jsonb,
  views jsonb NOT NULL DEFAULT '{}'::jsonb,
  feeding boolean,
  stopped text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX library_history_runs_started_idx ON public.library_history_runs (started_at);
REVOKE ALL ON public.library_history_runs FROM anon, authenticated;
GRANT ALL ON public.library_history_runs TO service_role;
ALTER TABLE public.library_history_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.library_history_view_state (
  view text PRIMARY KEY,
  position smallint NOT NULL,
  refreshed_at timestamptz,
  last_ms integer NOT NULL
);
REVOKE ALL ON public.library_history_view_state FROM anon, authenticated;
GRANT ALL ON public.library_history_view_state TO service_role;
ALTER TABLE public.library_history_view_state ENABLE ROW LEVEL SECURITY;
-- Starting estimates: each view's defining query timed on 21 Nov 2026 (quiet database), rounded up.
INSERT INTO public.library_history_view_state (view, position, last_ms) VALUES
  ('library_font_series_mat', 1, 200), ('library_tag_series_mat', 2, 600), ('library_signal_series_mat', 3, 1500),
  ('library_css_series_mat', 4, 1600), ('library_history_share_mat', 5, 6000);

-- 6 · The scheduled job (same name, same schedule). Budget: stops taking new work after 25 s; per-domain chunks of 10 commit on their
--     own; at most 40 domains a run; aggregates CONCURRENTLY, at most one pass per 30 minutes while captures are arriving (one in the
--     last 10 minutes), and a pass when it is quiet and something changed. Errors and volume never fail the run: what is left stays dirty.
CREATE OR REPLACE PROCEDURE public.library_history_refresh_job()
 LANGUAGE plpgsql
AS $procedure$
DECLARE
  k_budget constant interval := interval '25 seconds';
  k_max_domains constant integer := 40;
  k_chunk constant integer := 10;
  t0 timestamptz := clock_timestamp();
  doms text[]; marks bigint[]; i integer; j integer; d text; m bigint;
  t1 timestamptz; chunk_ms numeric := 0; n integer; done integer := 0; rows_w integer := 0;
  dms jsonb := '[]'::jsonb; views jsonb := '{}'::jsonb; stopped text := NULL;
  last_capture timestamptz; feeding boolean; c_dirty boolean; c_started timestamptz; c_refreshed timestamptz; in_pass boolean;
  v record; left_n integer; err text; old_lock_timeout text := current_setting('lock_timeout');
BEGIN
  IF NOT pg_try_advisory_lock(hashtextextended('library_history_refresh', 0)) THEN
    RAISE NOTICE 'library history refresh: another refresh holds the lock';
    RETURN;
  END IF;
  -- Session-level (SET LOCAL would end at the first COMMIT); restored before returning.
  PERFORM set_config('lock_timeout', '5s', false);

  -- A new quarter moves every live row: those domains are dirty without any write.
  PERFORM public.library_history_mark(ARRAY(SELECT h.domain FROM public.library_site_history_store h WHERE h.now AND h.quarter <> public.library_quarter(now())));
  SELECT array_agg(x.domain ORDER BY x.dirty_at, x.domain), array_agg(x.mark ORDER BY x.dirty_at, x.domain) INTO doms, marks
    FROM (SELECT q.domain, q.mark, q.dirty_at FROM public.library_history_dirty_domains q ORDER BY q.dirty_at, q.domain LIMIT k_max_domains) x;
  COMMIT;

  i := 1;
  WHILE doms IS NOT NULL AND i <= array_length(doms, 1) LOOP
    IF clock_timestamp() - t0 + make_interval(secs => chunk_ms / 1000.0) > k_budget THEN stopped := 'budget:rows'; EXIT; END IF;
    t1 := clock_timestamp();
    BEGIN
      FOR j IN i .. LEAST(i + k_chunk - 1, array_length(doms, 1)) LOOP
        d := doms[j]; m := marks[j];
        DECLARE td timestamptz := clock_timestamp(); BEGIN
          DELETE FROM public.library_site_history_store WHERE domain = d;
          INSERT INTO public.library_site_history_store SELECT * FROM public.library_site_history WHERE domain = d;
          GET DIAGNOSTICS n = ROW_COUNT; rows_w := rows_w + n;
          DELETE FROM public.library_history_dirty_domains WHERE domain = d AND mark = m;
          dms := dms || to_jsonb(round(extract(epoch FROM clock_timestamp() - td) * 1000, 1));
        END;
      END LOOP;
    EXCEPTION WHEN OTHERS OR query_canceled THEN
      err := SQLERRM; stopped := 'error:rows:' || left(err, 120);
    END;
    COMMIT;
    IF stopped IS NOT NULL THEN EXIT; END IF;
    done := done + (LEAST(i + k_chunk - 1, array_length(doms, 1)) - i + 1);
    chunk_ms := extract(epoch FROM clock_timestamp() - t1) * 1000;
    i := i + k_chunk;
  END LOOP;

  -- Aggregate series.
  last_capture := GREATEST((SELECT max(s.received_at) FROM public.library_snapshots s WHERE s.source = 'live'),
                           (SELECT max(s.received_at) FROM public.library_snapshots s WHERE s.source = 'wayback'));
  feeding := last_capture IS NOT NULL AND last_capture > now() - interval '10 minutes';
  SELECT c.dirty, c.refresh_started_at, c.refreshed_at INTO c_dirty, c_started, c_refreshed FROM public.library_history_control c WHERE c.id = 1;
  in_pass := c_started IS NOT NULL AND (c_refreshed IS NULL OR c_refreshed < c_started);
  IF NOT in_pass AND coalesce(c_dirty, false) AND (NOT feeding OR c_started IS NULL OR c_started < now() - interval '30 minutes') THEN
    UPDATE public.library_history_control SET dirty = false, refresh_started_at = now() WHERE id = 1 RETURNING refresh_started_at INTO c_started;
    in_pass := true;
    COMMIT;
  END IF;
  IF in_pass AND stopped IS NULL THEN
    FOR v IN SELECT s.view, s.last_ms FROM public.library_history_view_state s WHERE s.refreshed_at IS NULL OR s.refreshed_at < c_started ORDER BY s.position LOOP
      IF clock_timestamp() - t0 + make_interval(secs => v.last_ms * 1.2 / 1000.0) > k_budget THEN stopped := 'budget:views'; EXIT; END IF;
      t1 := clock_timestamp();
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v.view);
        n := round(extract(epoch FROM clock_timestamp() - t1) * 1000);
        UPDATE public.library_history_view_state SET refreshed_at = clock_timestamp(), last_ms = n WHERE view = v.view;
        views := views || jsonb_build_object(v.view, n);
      EXCEPTION WHEN OTHERS OR query_canceled THEN
        err := SQLERRM; stopped := 'error:' || v.view || ':' || left(err, 120);
      END;
      COMMIT;
      IF stopped IS NOT NULL THEN
        UPDATE public.library_history_view_state SET last_ms = GREATEST(last_ms, round(extract(epoch FROM clock_timestamp() - t1) * 1000)::integer) WHERE view = v.view;
        COMMIT; EXIT;
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.library_history_view_state s WHERE s.refreshed_at IS NULL OR s.refreshed_at < c_started) THEN
      UPDATE public.library_history_control SET refreshed_at = now() WHERE id = 1;
    END IF;
  END IF;

  SELECT count(*) INTO left_n FROM public.library_history_dirty_domains;
  IF done > 0 OR views <> '{}'::jsonb OR stopped IS NOT NULL THEN
    INSERT INTO public.library_history_runs (kind, started_at, ms, domains_done, domains_left, rows_written, domain_ms, views, feeding, stopped)
    VALUES ('job', t0, round(extract(epoch FROM clock_timestamp() - t0) * 1000), done, left_n, rows_w, dms, views, feeding, stopped);
  END IF;
  DELETE FROM public.library_history_runs WHERE started_at < now() - interval '30 days';
  COMMIT;
  PERFORM set_config('lock_timeout', old_lock_timeout, false);
  PERFORM pg_advisory_unlock(hashtextextended('library_history_refresh', 0));
END; $procedure$;

-- 7 · Weekly check (and manual full rebuild): per-domain checksums of stored rows against the view, in chunks with a pause.
CREATE PROCEDURE public.library_site_history_check(p_repair boolean DEFAULT true, p_chunk integer DEFAULT 40, p_pause_seconds double precision DEFAULT 2, p_force boolean DEFAULT false)
 LANGUAGE plpgsql
AS $procedure$
DECLARE
  t0 timestamptz := clock_timestamp(); doms text[]; i integer; j integer; d text; a text; b text; n integer;
  checked integer := 0; differ text[] := '{}'; repaired integer := 0; rows_w integer := 0;
BEGIN
  IF NOT pg_try_advisory_lock(hashtextextended('library_history_refresh', 0)) THEN
    RAISE NOTICE 'library history check: another refresh holds the lock';
    RETURN;
  END IF;
  SELECT array_agg(x.domain ORDER BY x.domain) INTO doms FROM (SELECT domain FROM public.library_sites UNION SELECT domain FROM public.library_site_history_store) x;
  i := 1;
  WHILE doms IS NOT NULL AND i <= array_length(doms, 1) LOOP
    FOR j IN i .. LEAST(i + p_chunk - 1, array_length(doms, 1)) LOOP
      d := doms[j];
      SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.quarter), '')) INTO a FROM public.library_site_history_store t WHERE t.domain = d;
      SELECT md5(coalesce(string_agg(v::text, '|' ORDER BY v.quarter), '')) INTO b FROM public.library_site_history v WHERE v.domain = d;
      checked := checked + 1;
      IF p_force OR a IS DISTINCT FROM b THEN
        IF a IS DISTINCT FROM b THEN differ := differ || d; END IF;
        IF p_repair THEN
          DELETE FROM public.library_site_history_store WHERE domain = d;
          INSERT INTO public.library_site_history_store SELECT * FROM public.library_site_history WHERE domain = d;
          GET DIAGNOSTICS n = ROW_COUNT; rows_w := rows_w + n; repaired := repaired + 1;
        END IF;
      END IF;
    END LOOP;
    COMMIT;
    i := i + p_chunk;
    IF i <= array_length(doms, 1) AND p_pause_seconds > 0 THEN PERFORM pg_sleep(p_pause_seconds); END IF;
  END LOOP;
  INSERT INTO public.library_history_runs (kind, started_at, ms, domains_done, rows_written, detail)
  VALUES (CASE WHEN p_force THEN 'rebuild' ELSE 'check' END, t0, round(extract(epoch FROM clock_timestamp() - t0) * 1000), checked, rows_w,
          jsonb_build_object('differ', to_jsonb(differ), 'repaired', repaired, 'repair', p_repair));
  COMMIT;
  PERFORM pg_advisory_unlock(hashtextextended('library_history_refresh', 0));
END; $procedure$;
-- The full rebuild for manual use: every domain replaced, chunks of 40, no pause.
CREATE PROCEDURE public.library_site_history_rebuild()
 LANGUAGE plpgsql
AS $procedure$ BEGIN CALL public.library_site_history_check(true, 40, 0, true); END; $procedure$;
REVOKE ALL ON PROCEDURE public.library_history_refresh_job() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON PROCEDURE public.library_site_history_check(boolean, integer, double precision, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON PROCEDURE public.library_site_history_rebuild() FROM PUBLIC, anon, authenticated;

-- 8 · Health: the public history facts also say how far the stored rows are behind (domains dirty for more than 30 minutes).
CREATE OR REPLACE FUNCTION public.library_history_facts()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT COALESCE((SELECT jsonb_build_object('refresh_started_at',c.refresh_started_at,'refreshed_at',c.refreshed_at) FROM public.library_history_control c WHERE c.id=1),jsonb_build_object('refresh_started_at',NULL,'refreshed_at',NULL))
  || jsonb_build_object(
   'rows_dirty', (SELECT count(*) FROM public.library_history_dirty_domains),
   'rows_behind', (SELECT count(*) FROM public.library_history_dirty_domains q WHERE q.dirty_at < now() - interval '30 minutes'),
   'rows_oldest_dirty_at', (SELECT min(q.dirty_at) FROM public.library_history_dirty_domains q),
   'rows_run_at', (SELECT max(r.finished_at) FROM public.library_history_runs r WHERE r.kind = 'job'));
$function$;