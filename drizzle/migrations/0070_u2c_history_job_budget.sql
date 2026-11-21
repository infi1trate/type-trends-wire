-- U2c · the job's budget, enforced. PostgreSQL does not re-arm statement_timeout inside one CALL (measured on this server, 17.11),
-- but transaction_timeout (PG 17) is armed at the start of every transaction, including those a procedure opens after COMMIT. So each
-- step (a chunk of up to 10 domains, or one aggregate refresh) is its own transaction under a 20 s transaction_timeout; the job stops
-- taking new work once elapsed time plus the next step's estimate passes 25 s. A step cut off at 20 s ends the session (PostgreSQL
-- terminates on transaction_timeout): its work rolls back and stays dirty, and the try count / attempt time recorded beforehand moves
-- that domain to the back of the queue or takes that view out of the cadence, so no single item can stall every run.
ALTER TABLE public.library_history_dirty_domains ADD COLUMN tries smallint NOT NULL DEFAULT 0;
CREATE INDEX library_history_dirty_domains_pick_idx ON public.library_history_dirty_domains (tries, dirty_at, domain);
ALTER TABLE public.library_history_view_state ADD COLUMN attempt_at timestamptz;

CREATE OR REPLACE PROCEDURE public.library_history_refresh_job()
 LANGUAGE plpgsql
AS $procedure$
DECLARE
  k_budget_ms constant numeric := 25000;
  k_step constant text := '20s';
  k_max_domains constant integer := 40;
  k_chunk constant integer := 10;
  t0 timestamptz := clock_timestamp();
  t_pick timestamptz;
  doms text[]; marks bigint[]; i integer; j integer; hi integer; d text; m bigint;
  t1 timestamptz; n integer; done integer := 0; rows_w integer := 0; c_rows integer; c_dms jsonb;
  dom_est numeric; elapsed numeric;
  dms jsonb := '[]'::jsonb; views jsonb := '{}'::jsonb; skipped jsonb := '[]'::jsonb; stopped text := NULL;
  last_capture timestamptz; feeding boolean; c_dirty boolean; c_started timestamptz; c_refreshed timestamptz; in_pass boolean;
  v record; left_n integer; err text;
  old_lock text := current_setting('lock_timeout'); old_tx text := current_setting('transaction_timeout');
BEGIN
  IF NOT pg_try_advisory_lock(hashtextextended('library_history_refresh', 0)) THEN
    RAISE NOTICE 'library history refresh: another refresh holds the lock';
    RETURN;
  END IF;
  -- Session-level (SET LOCAL ends at the first COMMIT); restored before returning. transaction_timeout applies from the next transaction.
  PERFORM set_config('lock_timeout', '5s', false);
  PERFORM set_config('transaction_timeout', k_step, false);
  COMMIT;

  -- A view refresh that was cut off last time (attempt recorded, never finished, nobody else holds the lock): never fits the budget again.
  UPDATE public.library_history_view_state SET last_ms = GREATEST(last_ms, 30000), attempt_at = NULL
   WHERE attempt_at IS NOT NULL AND (refreshed_at IS NULL OR refreshed_at < attempt_at);
  -- A new quarter moves every live row: those domains are dirty without any write.
  PERFORM public.library_history_mark(ARRAY(SELECT h.domain FROM public.library_site_history_store h WHERE h.now AND h.quarter <> public.library_quarter(now())));
  t_pick := clock_timestamp();
  SELECT array_agg(x.domain ORDER BY x.tries, x.dirty_at, x.domain), array_agg(x.mark ORDER BY x.tries, x.dirty_at, x.domain) INTO doms, marks
    FROM (SELECT q.domain, q.mark, q.dirty_at, q.tries FROM public.library_history_dirty_domains q ORDER BY q.tries, q.dirty_at, q.domain LIMIT k_max_domains) x;
  -- Per-domain estimate: the slowest domain of the last ten runs (500 ms before any run).
  SELECT COALESCE(max(e::numeric), 500) INTO dom_est
    FROM (SELECT r.domain_ms FROM public.library_history_runs r WHERE r.kind = 'job' AND r.domain_ms <> '[]'::jsonb ORDER BY r.started_at DESC LIMIT 10) r,
         jsonb_array_elements_text(r.domain_ms) e;
  COMMIT;

  i := 1;
  WHILE doms IS NOT NULL AND i <= cardinality(doms) LOOP
    hi := LEAST(i + k_chunk - 1, cardinality(doms));
    elapsed := extract(epoch FROM clock_timestamp() - t0) * 1000;
    IF elapsed + dom_est * (hi - i + 1) > k_budget_ms THEN stopped := 'budget:rows'; EXIT; END IF;
    -- Count the try first (its own transaction), so a chunk that is ever cut off goes to the back of the queue.
    UPDATE public.library_history_dirty_domains SET tries = tries + 1 WHERE domain = ANY (doms[i:hi]);
    COMMIT;
    c_rows := 0; c_dms := '[]'::jsonb;
    BEGIN
      FOR j IN i .. hi LOOP
        d := doms[j]; m := marks[j]; t1 := clock_timestamp();
        DELETE FROM public.library_site_history_store WHERE domain = d;
        INSERT INTO public.library_site_history_store SELECT * FROM public.library_site_history WHERE domain = d;
        GET DIAGNOSTICS n = ROW_COUNT; c_rows := c_rows + n;
        -- Cleared only if no write marked it again since it was picked; a re-marked domain stays, at the front, dated from the pick.
        DELETE FROM public.library_history_dirty_domains WHERE domain = d AND mark = m;
        UPDATE public.library_history_dirty_domains SET tries = 0, dirty_at = GREATEST(dirty_at, t_pick) WHERE domain = d;
        c_dms := c_dms || to_jsonb(round(extract(epoch FROM clock_timestamp() - t1) * 1000, 1));
      END LOOP;
    EXCEPTION WHEN OTHERS OR query_canceled THEN
      err := SQLERRM; stopped := 'error:rows:' || left(err, 120);
    END;
    COMMIT;
    IF stopped IS NOT NULL THEN EXIT; END IF;
    done := done + (hi - i + 1); rows_w := rows_w + c_rows; dms := dms || c_dms;
    SELECT GREATEST(dom_est * 0.5, max(e::numeric)) INTO dom_est FROM jsonb_array_elements_text(c_dms) e;
    i := hi + 1;
  END LOOP;

  -- Aggregate series: CONCURRENTLY, one view per transaction; a pass at most every 30 minutes while captures arrive (one in the last
  -- 10 minutes) and one when it goes quiet; an unfinished pass is resumed by later runs for up to two hours.
  last_capture := GREATEST((SELECT max(s.received_at) FROM public.library_snapshots s WHERE s.source = 'live'),
                           (SELECT max(s.received_at) FROM public.library_snapshots s WHERE s.source = 'wayback'));
  feeding := last_capture IS NOT NULL AND last_capture > now() - interval '10 minutes';
  SELECT c.dirty, c.refresh_started_at, c.refreshed_at INTO c_dirty, c_started, c_refreshed FROM public.library_history_control c WHERE c.id = 1;
  in_pass := c_started IS NOT NULL AND (c_refreshed IS NULL OR c_refreshed < c_started) AND c_started > now() - interval '2 hours';
  IF stopped IS NULL AND NOT in_pass AND coalesce(c_dirty, false) AND (NOT feeding OR c_started IS NULL OR c_started < now() - interval '30 minutes') THEN
    UPDATE public.library_history_control SET dirty = false, refresh_started_at = now() WHERE id = 1 RETURNING refresh_started_at INTO c_started;
    in_pass := true;
  END IF;
  COMMIT;
  IF in_pass AND stopped IS NULL THEN
    FOR v IN SELECT s.view, s.last_ms FROM public.library_history_view_state s WHERE s.refreshed_at IS NULL OR s.refreshed_at < c_started ORDER BY s.position LOOP
      IF v.last_ms * 1.2 > k_budget_ms THEN skipped := skipped || to_jsonb(v.view); CONTINUE; END IF; -- too slow for any run: visible in the run log and health
      elapsed := extract(epoch FROM clock_timestamp() - t0) * 1000;
      IF elapsed + v.last_ms * 1.2 > k_budget_ms THEN stopped := 'budget:views'; EXIT; END IF;
      UPDATE public.library_history_view_state SET attempt_at = clock_timestamp() WHERE view = v.view;
      COMMIT;
      t1 := clock_timestamp();
      BEGIN
        EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v.view);
        n := round(extract(epoch FROM clock_timestamp() - t1) * 1000);
        UPDATE public.library_history_view_state SET refreshed_at = clock_timestamp(), last_ms = n, attempt_at = NULL WHERE view = v.view;
        views := views || jsonb_build_object(v.view, n);
      EXCEPTION WHEN OTHERS OR query_canceled THEN
        err := SQLERRM; stopped := 'error:' || v.view || ':' || left(err, 120);
      END;
      COMMIT;
      IF stopped IS NOT NULL THEN
        UPDATE public.library_history_view_state SET attempt_at = NULL, last_ms = GREATEST(last_ms, round(extract(epoch FROM clock_timestamp() - t1) * 1000)::integer) WHERE view = v.view;
        COMMIT; EXIT;
      END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.library_history_view_state s WHERE s.refreshed_at IS NULL OR s.refreshed_at < c_started) THEN
      UPDATE public.library_history_control SET refreshed_at = now() WHERE id = 1;
    END IF;
  END IF;

  SELECT count(*) INTO left_n FROM public.library_history_dirty_domains;
  IF done > 0 OR views <> '{}'::jsonb OR stopped IS NOT NULL OR skipped <> '[]'::jsonb THEN
    INSERT INTO public.library_history_runs (kind, started_at, ms, domains_done, domains_left, rows_written, domain_ms, views, feeding, stopped, detail)
    VALUES ('job', t0, round(extract(epoch FROM clock_timestamp() - t0) * 1000), done, left_n, rows_w, dms, views, feeding, stopped,
            jsonb_build_object('skipped_views', skipped, 'domain_estimate_ms', round(dom_est, 1)));
  END IF;
  DELETE FROM public.library_history_runs WHERE started_at < now() - interval '30 days';
  COMMIT;
  PERFORM set_config('lock_timeout', old_lock, false);
  PERFORM set_config('transaction_timeout', old_tx, false);
  PERFORM pg_advisory_unlock(hashtextextended('library_history_refresh', 0));
END; $procedure$;
REVOKE ALL ON PROCEDURE public.library_history_refresh_job() FROM PUBLIC, anon, authenticated;

-- Health: also name aggregate series too slow for the budget (they stop refreshing, visibly, instead of overloading the database).
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
   'rows_run_at', (SELECT max(r.finished_at) FROM public.library_history_runs r WHERE r.kind = 'job'),
   'views_too_slow', (SELECT COALESCE(jsonb_agg(s.view ORDER BY s.position), '[]'::jsonb) FROM public.library_history_view_state s WHERE s.last_ms * 1.2 > 25000));
$function$;