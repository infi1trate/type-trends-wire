CREATE TABLE public.library_baselines (
 domain text NOT NULL REFERENCES public.library_sites(domain) ON DELETE CASCADE,
 page_type text NOT NULL, viewport text NOT NULL, source text NOT NULL,
 signals jsonb NOT NULL, snapshot_id bigint REFERENCES public.library_snapshots(id),
 confirmed_at timestamptz NOT NULL, pending jsonb NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(domain,page_type,viewport,source)
);
GRANT ALL ON public.library_baselines TO service_role;
REVOKE ALL ON public.library_baselines FROM anon,authenticated;
ALTER TABLE public.library_baselines ENABLE ROW LEVEL SECURITY;
CREATE VIEW public.library_pending AS
 SELECT b.domain,b.page_type,b.viewport,p.key AS field,
 CASE WHEN p.key IN ('h1','body') THEN p.value#>'{from,family}' ELSE p.value->'from' END AS "from",
 CASE WHEN p.key IN ('h1','body') THEN p.value#>'{to,family}' ELSE p.value->'to' END AS "to",
 (p.value->>'first_seen_at')::timestamptz AS first_seen_at
 FROM public.library_baselines b CROSS JOIN LATERAL jsonb_each(b.pending) p;
GRANT SELECT ON public.library_pending TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.library_snapshot_context(p_snapshot jsonb) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object(
 'prev',(SELECT jsonb_build_object('id',id,'signals',signals,'content_hash',content_hash) FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source' AND captured_at<(p_snapshot->>'captured_at')::timestamptz ORDER BY captured_at DESC LIMIT 1),
 'baseline',(SELECT jsonb_build_object('signals',signals,'snapshot_id',snapshot_id,'confirmed_at',confirmed_at,'pending',pending) FROM public.library_baselines WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source'),
 'sector',(SELECT sector FROM public.library_sites WHERE domain=p_snapshot->>'domain'),
 'new_surface',NOT EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type') AND EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND captured_at<(p_snapshot->>'captured_at')::timestamptz-interval '24 hours'),
 'first_captured_at',(SELECT min(captured_at) FROM public.library_snapshots WHERE domain=p_snapshot->>'domain'),
 'latest_captured_at',(SELECT max(captured_at) FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source'));
 $$;
CREATE OR REPLACE FUNCTION public.library_store_snapshot(p_snapshot jsonb,p_context jsonb,p_events jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE sid bigint; n integer; current_context jsonb; state jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_snapshot->>'domain',0));
 IF EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source' AND captured_at=(p_snapshot->>'captured_at')::timestamptz) THEN RETURN jsonb_build_object('inserted',0,'events',0); END IF;
 current_context:=public.library_snapshot_context(p_snapshot);
 IF current_context IS DISTINCT FROM p_context THEN RETURN jsonb_build_object('retry',true); END IF;
 INSERT INTO public.library_snapshots(domain,page_type,viewport,source,captured_at,url,run_id,html_hash,content_hash,signals_hash,signals) VALUES(p_snapshot->>'domain',p_snapshot->>'page_type',p_snapshot->>'viewport',p_snapshot->>'source',(p_snapshot->>'captured_at')::timestamptz,p_snapshot->>'url',p_snapshot->>'run_id',p_snapshot->>'html_hash',p_snapshot->>'content_hash',p_snapshot->>'signals_hash',p_snapshot->'signals') ON CONFLICT DO NOTHING RETURNING id INTO sid;
 IF sid IS NULL THEN RETURN jsonb_build_object('inserted',0,'events',0); END IF;
 IF p_snapshot ? 'raw_text' THEN INSERT INTO public.library_snapshot_text VALUES(sid,p_snapshot->>'raw_text'); END IF;
 IF jsonb_typeof(p_events) <> 'object' THEN RAISE EXCEPTION 'Confirmation state required'; END IF;
 IF current_context->>'latest_captured_at' IS NULL OR (p_snapshot->>'captured_at')::timestamptz > (current_context->>'latest_captured_at')::timestamptz THEN
 state:=p_events->'baseline';
 INSERT INTO public.library_baselines(domain,page_type,viewport,source,signals,snapshot_id,confirmed_at,pending) VALUES(p_snapshot->>'domain',p_snapshot->>'page_type',p_snapshot->>'viewport',p_snapshot->>'source',state->'signals',coalesce((state->>'snapshot_id')::bigint,sid),(state->>'confirmed_at')::timestamptz,coalesce(p_events->'pending','{}'::jsonb))
 ON CONFLICT(domain,page_type,viewport,source) DO UPDATE SET signals=excluded.signals,snapshot_id=excluded.snapshot_id,confirmed_at=excluded.confirmed_at,pending=excluded.pending;
 UPDATE public.library_baselines SET pending=(SELECT coalesce(jsonb_object_agg(key,CASE WHEN value->>'first_seen_snapshot_id' IS NULL THEN jsonb_set(value,'{first_seen_snapshot_id}',to_jsonb(sid)) ELSE value END),'{}'::jsonb) FROM jsonb_each(pending)) WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source';
 INSERT INTO public.library_events(domain,page_type,viewport,effective_at,type,severity,summary,before,after,prev_snapshot_id,snapshot_id)
 SELECT p_snapshot->>'domain',p_snapshot->>'page_type',p_snapshot->>'viewport',coalesce((x->>'effective_at')::timestamptz,(p_snapshot->>'captured_at')::timestamptz),x->>'type',(x->>'severity')::smallint,x->>'summary',x->'before',x->'after',coalesce((x->>'prev_snapshot_id')::bigint,(current_context#>>'{baseline,snapshot_id}')::bigint),sid FROM jsonb_array_elements(p_events->'events') x;
 GET DIAGNOSTICS n=ROW_COUNT;
 ELSE n:=0; END IF;
 UPDATE public.library_sites SET last_snapshot_at=greatest(last_snapshot_at,(p_snapshot->>'captured_at')::timestamptz),last_change_at=CASE WHEN n>0 THEN greatest(last_change_at,(p_snapshot->>'captured_at')::timestamptz) ELSE last_change_at END,pages=coalesce(pages,'{}'::jsonb)||coalesce(p_snapshot->'discovered_pages','{}'::jsonb) WHERE domain=p_snapshot->>'domain';
 RETURN jsonb_build_object('inserted',1,'events',n);
END; $$;
REVOKE ALL ON FUNCTION public.library_snapshot_context(jsonb),public.library_store_snapshot(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_snapshot_context(jsonb),public.library_store_snapshot(jsonb,jsonb,jsonb) TO service_role;