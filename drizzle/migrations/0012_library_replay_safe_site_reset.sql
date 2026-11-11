CREATE OR REPLACE FUNCTION public.library_replace_history(p_ids bigint[],p_history jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d text; n integer;
BEGIN
 FOR d IN SELECT domain FROM public.library_sites ORDER BY domain LOOP PERFORM pg_advisory_xact_lock(hashtextextended(d,0)); END LOOP;
 LOCK TABLE public.library_snapshots IN SHARE MODE;
 IF (SELECT coalesce(array_agg(id ORDER BY id),'{}'::bigint[]) FROM public.library_snapshots) IS DISTINCT FROM (SELECT coalesce(array_agg(x ORDER BY x),'{}'::bigint[]) FROM unnest(p_ids) x) THEN RAISE EXCEPTION 'Snapshots changed; retry replay'; END IF;
 DELETE FROM public.library_events WHERE id IS NOT NULL;
 DELETE FROM public.library_baselines WHERE domain IS NOT NULL;
 INSERT INTO public.library_baselines(domain,page_type,viewport,source,signals,snapshot_id,confirmed_at,pending)
 SELECT x->>'domain',x->>'page_type',x->>'viewport',x->>'source',x#>'{baseline,signals}',(x#>>'{baseline,snapshot_id}')::bigint,(x#>>'{baseline,confirmed_at}')::timestamptz,x->'pending' FROM jsonb_array_elements(p_history->'baselines') x;
 INSERT INTO public.library_events(domain,page_type,viewport,detected_at,effective_at,type,severity,summary,before,after,prev_snapshot_id,snapshot_id)
 SELECT x->>'domain',x->>'page_type',x->>'viewport',(x->>'detected_at')::timestamptz,coalesce((x->>'effective_at')::timestamptz,(x->>'detected_at')::timestamptz),x->>'type',(x->>'severity')::smallint,x->>'summary',x->'before',x->'after',(x->>'prev_snapshot_id')::bigint,(x->>'snapshot_id')::bigint FROM jsonb_array_elements(p_history->'events') x;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.library_sites s SET last_change_at=(SELECT max(e.detected_at) FROM public.library_events e WHERE e.domain=s.domain) WHERE s.domain IS NOT NULL;
 RETURN jsonb_build_object('ok',true,'snapshots',cardinality(p_ids),'baselines',jsonb_array_length(p_history->'baselines'),'events',n);
END; $$;
REVOKE ALL ON FUNCTION public.library_replace_history(bigint[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_replace_history(bigint[],jsonb) TO service_role;