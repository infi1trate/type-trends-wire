CREATE PROCEDURE public.library_history_refresh_job() LANGUAGE plpgsql AS $$
DECLARE
 v text;
 ok boolean;
 busy boolean;
 err text;
BEGIN
 -- Begin: same rule as library_history_refresh_begin, without the 5-minute spacing (the schedule is the spacing).
 IF NOT pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
  RAISE NOTICE 'library history refresh: another refresh holds the lock';
  RETURN;
 END IF;
 UPDATE public.library_history_control SET dirty=false, refresh_started_at=now() WHERE id=1 AND dirty;
 IF NOT FOUND THEN RETURN; END IF;
 COMMIT;
 -- Small views first, the large share view last; one transaction per view.
 FOREACH v IN ARRAY ARRAY['library_signal_series_mat','library_css_series_mat','library_font_series_mat','library_tag_series_mat','library_history_share_mat'] LOOP
  ok := true; busy := false; err := NULL;
  BEGIN
   IF pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
    SET LOCAL lock_timeout = '20s';
    EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', v);
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
END; $$;
REVOKE ALL ON PROCEDURE public.library_history_refresh_job() FROM PUBLIC, anon, authenticated, service_role;