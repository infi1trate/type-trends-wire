ALTER TABLE public.library_history_control ADD COLUMN IF NOT EXISTS refresh_started_at timestamptz, ADD COLUMN IF NOT EXISTS refreshed_at timestamptz;
COMMENT ON COLUMN public.library_history_control.refresh_started_at IS 'When the last stepwise history refresh started (dirty is cleared at the same moment).';
COMMENT ON COLUMN public.library_history_control.refreshed_at IS 'When the last stepwise history refresh finished all five views.';

CREATE FUNCTION public.library_history_refresh_begin(p_min_age_seconds integer DEFAULT 300) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dirty boolean; v_started timestamptz; v_refreshed timestamptz;
BEGIN
 IF NOT pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
  RETURN jsonb_build_object('started',false,'reason','busy');
 END IF;
 SELECT c.dirty,c.refresh_started_at,c.refreshed_at INTO v_dirty,v_started,v_refreshed FROM public.library_history_control c WHERE c.id=1 FOR UPDATE;
 IF NOT FOUND OR NOT v_dirty THEN
  RETURN jsonb_build_object('started',false,'reason','clean','refresh_started_at',v_started,'refreshed_at',v_refreshed);
 END IF;
 IF v_started IS NOT NULL AND v_started > now() - make_interval(secs => GREATEST(p_min_age_seconds,0)) THEN
  RETURN jsonb_build_object('started',false,'reason','recent','refresh_started_at',v_started,'refreshed_at',v_refreshed);
 END IF;
 UPDATE public.library_history_control SET dirty=false, refresh_started_at=now() WHERE id=1;
 RETURN jsonb_build_object('started',true,'reason','started','refresh_started_at',now(),'refreshed_at',v_refreshed);
END; $$;

CREATE FUNCTION public.library_history_refresh_view(p_view text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t0 timestamptz;
BEGIN
 IF p_view IS NULL OR p_view NOT IN ('library_history_share_mat','library_signal_series_mat','library_css_series_mat','library_font_series_mat','library_tag_series_mat') THEN
  RAISE EXCEPTION 'unknown history view' USING ERRCODE='22023';
 END IF;
 IF NOT pg_try_advisory_xact_lock(hashtextextended('library_history_refresh',0)) THEN
  RETURN jsonb_build_object('ok',false,'skipped',true,'ms',0);
 END IF;
 t0 := clock_timestamp();
 EXECUTE format('REFRESH MATERIALIZED VIEW public.%I', p_view);
 RETURN jsonb_build_object('ok',true,'skipped',false,'ms',round(extract(epoch FROM clock_timestamp()-t0)*1000));
END; $$;

CREATE FUNCTION public.library_history_refresh_end(p_ok boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_dirty boolean; v_refreshed timestamptz;
BEGIN
 IF p_ok THEN
  UPDATE public.library_history_control SET refreshed_at=now() WHERE id=1 RETURNING dirty,refreshed_at INTO v_dirty,v_refreshed;
 ELSE
  UPDATE public.library_history_control SET dirty=true WHERE id=1 RETURNING dirty,refreshed_at INTO v_dirty,v_refreshed;
 END IF;
 RETURN jsonb_build_object('dirty',v_dirty,'refreshed_at',v_refreshed);
END; $$;

CREATE FUNCTION public.library_history_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT jsonb_build_object('refresh_started_at',c.refresh_started_at,'refreshed_at',c.refreshed_at) FROM public.library_history_control c WHERE c.id=1),jsonb_build_object('refresh_started_at',NULL,'refreshed_at',NULL));
$$;

REVOKE ALL ON FUNCTION public.library_history_refresh_begin(integer), public.library_history_refresh_view(text), public.library_history_refresh_end(boolean), public.library_history_facts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_history_refresh_begin(integer), public.library_history_refresh_view(text), public.library_history_refresh_end(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.library_history_facts() TO anon, authenticated, service_role;