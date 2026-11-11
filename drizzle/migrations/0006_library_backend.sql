CREATE TABLE public.library_sites (
 domain text PRIMARY KEY CHECK (domain = lower(domain) AND domain NOT LIKE 'www.%'),
 sector text NOT NULL CHECK (sector IN ('ai','dev-tools','fintech','consumer-apps','commerce-dtc','media','studios','hardware','health','enterprise-saas')),
 name text, active boolean DEFAULT true, added_at timestamptz DEFAULT now(), last_snapshot_at timestamptz, last_change_at timestamptz, pages jsonb DEFAULT '{}'
);
GRANT SELECT ON public.library_sites TO anon, authenticated;
GRANT ALL ON public.library_sites TO service_role;
ALTER TABLE public.library_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_sites FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.library_snapshots (
 id bigserial PRIMARY KEY, domain text NOT NULL REFERENCES public.library_sites(domain) ON DELETE CASCADE,
 page_type text NOT NULL CHECK (page_type IN ('home','pricing','changelog','product','about')),
 viewport text NOT NULL CHECK (viewport IN ('desktop','mobile')), source text NOT NULL DEFAULT 'live' CHECK (source IN ('live','wayback')),
 captured_at timestamptz NOT NULL, url text, run_id text, html_hash text, content_hash text, signals_hash text, signals jsonb NOT NULL,
 UNIQUE(domain,page_type,viewport,source,captured_at)
);
GRANT SELECT ON public.library_snapshots TO anon, authenticated;
GRANT ALL ON public.library_snapshots TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.library_snapshots_id_seq TO service_role;
ALTER TABLE public.library_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX library_snapshots_key_time_idx ON public.library_snapshots(domain,page_type,viewport,captured_at DESC);
CREATE INDEX library_snapshots_live_latest_idx ON public.library_snapshots(domain,page_type,viewport,captured_at DESC) WHERE source='live';
CREATE TABLE public.library_snapshot_text (
 snapshot_id bigint PRIMARY KEY REFERENCES public.library_snapshots(id) ON DELETE CASCADE, raw_text text NOT NULL
);
REVOKE ALL ON public.library_snapshot_text FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.library_snapshot_text TO service_role;
ALTER TABLE public.library_snapshot_text ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.library_events (
 id bigserial PRIMARY KEY, domain text NOT NULL REFERENCES public.library_sites(domain) ON DELETE CASCADE, page_type text NOT NULL, viewport text NOT NULL,
 detected_at timestamptz DEFAULT now(), effective_at timestamptz,
 type text NOT NULL CHECK (type IN ('type_change','palette_shift','theme_flip','layout_change','redesign','message_pivot','pricing_change','new_surface','stack_change','nav_change')),
 severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 3), summary text, before jsonb, after jsonb,
 prev_snapshot_id bigint REFERENCES public.library_snapshots(id), snapshot_id bigint REFERENCES public.library_snapshots(id), UNIQUE(snapshot_id,type)
);
GRANT SELECT ON public.library_events TO anon, authenticated;
GRANT ALL ON public.library_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.library_events_id_seq TO service_role;
ALTER TABLE public.library_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_events FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX library_events_time_idx ON public.library_events(detected_at DESC);
CREATE INDEX library_events_domain_time_idx ON public.library_events(domain,detected_at DESC);
CREATE INDEX library_events_type_time_idx ON public.library_events(type,detected_at DESC);
CREATE VIEW public.library_latest WITH (security_invoker=true) AS
SELECT s.domain,s.sector,s.last_snapshot_at,s.last_change_at,
 h.signals #>> '{type,rendered,h1,family}' AS h1_family, h.signals #>> '{type,rendered,body,family}' AS body_family,
 h.signals #>> '{color,theme}' AS theme, h.signals #>> '{color,accent}' AS accent, h.signals #>> '{layout,hero_media}' AS hero_media,
 CASE WHEN jsonb_typeof(h.signals #> '{composition,whitespace_ratio}')='number' THEN (h.signals #>> '{composition,whitespace_ratio}')::double precision END AS whitespace_ratio,
 (SELECT count(*) FROM public.library_events e WHERE e.domain=s.domain AND e.detected_at>=now()-interval '30 days') AS events_30d
FROM public.library_sites s LEFT JOIN LATERAL (
 SELECT signals FROM public.library_snapshots WHERE domain=s.domain AND page_type='home' AND viewport='desktop' AND source='live' ORDER BY captured_at DESC LIMIT 1
) h ON true WHERE s.active=true;
CREATE VIEW public.library_event_feed WITH (security_invoker=true) AS
SELECT e.*,s.sector FROM public.library_events e JOIN public.library_sites s USING(domain) ORDER BY e.detected_at DESC,e.id DESC LIMIT 200;
CREATE VIEW public.library_sector_stats WITH (security_invoker=true) AS
SELECT sector,count(*) AS sites,count(last_snapshot_at) AS sites_snapshotted,
 avg((theme='dark')::int) FILTER (WHERE theme IS NOT NULL) AS dark_theme_share,
 avg((h1_family ~* '(serif|times|georgia|garamond|baskerville|bodoni|didot|caslon|playfair|lora|merriweather|literata|fraunces|tiempos|canela|domaine|editorial|recoleta|ivypresto)')::int) FILTER (WHERE h1_family IS NOT NULL) AS serif_headline_share,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY whitespace_ratio) AS median_whitespace_ratio,sum(events_30d) AS events_30d
FROM public.library_latest GROUP BY sector;
GRANT SELECT ON public.library_latest,public.library_event_feed,public.library_sector_stats TO anon,authenticated,service_role;
CREATE FUNCTION public.library_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH latest AS (
 SELECT DISTINCT ON (domain,page_type,viewport) domain,page_type,viewport,html_hash,content_hash,signals_hash,captured_at
 FROM public.library_snapshots WHERE source='live' ORDER BY domain,page_type,viewport,captured_at DESC
), hashes AS (
 SELECT domain,jsonb_object_agg(page_type||':'||viewport,jsonb_build_object('html_hash',html_hash,'content_hash',content_hash,'signals_hash',signals_hash,'captured_at',captured_at)) AS latest FROM latest GROUP BY domain
)
SELECT jsonb_build_object('sites',coalesce(jsonb_agg(jsonb_build_object('domain',s.domain,'sector',s.sector,'active',s.active,'pages',s.pages,'latest',coalesce(h.latest,'{}'::jsonb)) ORDER BY s.domain),'[]'::jsonb)) FROM public.library_sites s LEFT JOIN hashes h USING(domain) WHERE s.active=true;
$$;
REVOKE ALL ON FUNCTION public.library_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_state() TO service_role;
CREATE FUNCTION public.library_sync(p_sites jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('library_sync',0));
 INSERT INTO public.library_sites(domain,sector,name,active) SELECT x->>'domain',x->>'sector',x->>'name',true FROM jsonb_array_elements(p_sites) x
 ON CONFLICT(domain) DO UPDATE SET sector=excluded.sector,name=coalesce(excluded.name,public.library_sites.name),active=true;
 UPDATE public.library_sites SET active=false WHERE active=true AND domain NOT IN (SELECT x->>'domain' FROM jsonb_array_elements(p_sites) x);
END; $$;
REVOKE ALL ON FUNCTION public.library_sync(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_sync(jsonb) TO service_role;
CREATE FUNCTION public.library_snapshot_context(p_snapshot jsonb) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
SELECT jsonb_build_object('prev',(SELECT jsonb_build_object('id',id,'signals',signals,'content_hash',content_hash) FROM public.library_snapshots
 WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source' AND captured_at<(p_snapshot->>'captured_at')::timestamptz ORDER BY captured_at DESC LIMIT 1),
 'new_surface',NOT EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type') AND EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain'));
$$;
REVOKE ALL ON FUNCTION public.library_snapshot_context(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_snapshot_context(jsonb) TO service_role;
CREATE FUNCTION public.library_store_snapshot(p_snapshot jsonb,p_context jsonb,p_events jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE sid bigint; n integer; current_context jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_snapshot->>'domain',0));
 IF EXISTS(SELECT 1 FROM public.library_snapshots WHERE domain=p_snapshot->>'domain' AND page_type=p_snapshot->>'page_type' AND viewport=p_snapshot->>'viewport' AND source=p_snapshot->>'source' AND captured_at=(p_snapshot->>'captured_at')::timestamptz) THEN RETURN jsonb_build_object('inserted',0,'events',0); END IF;
 current_context:=public.library_snapshot_context(p_snapshot);
 IF current_context IS DISTINCT FROM p_context THEN RETURN jsonb_build_object('retry',true); END IF;
 INSERT INTO public.library_snapshots(domain,page_type,viewport,source,captured_at,url,run_id,html_hash,content_hash,signals_hash,signals)
 VALUES(p_snapshot->>'domain',p_snapshot->>'page_type',p_snapshot->>'viewport',p_snapshot->>'source',(p_snapshot->>'captured_at')::timestamptz,p_snapshot->>'url',p_snapshot->>'run_id',p_snapshot->>'html_hash',p_snapshot->>'content_hash',p_snapshot->>'signals_hash',p_snapshot->'signals') ON CONFLICT DO NOTHING RETURNING id INTO sid;
 IF sid IS NULL THEN RETURN jsonb_build_object('inserted',0,'events',0); END IF;
 IF p_snapshot ? 'raw_text' THEN INSERT INTO public.library_snapshot_text VALUES(sid,p_snapshot->>'raw_text'); END IF;
 INSERT INTO public.library_events(domain,page_type,viewport,effective_at,type,severity,summary,before,after,prev_snapshot_id,snapshot_id)
 SELECT p_snapshot->>'domain',p_snapshot->>'page_type',p_snapshot->>'viewport',(p_snapshot->>'captured_at')::timestamptz,x->>'type',(x->>'severity')::smallint,x->>'summary',x->'before',x->'after',(current_context#>>'{prev,id}')::bigint,sid FROM jsonb_array_elements(p_events) x;
 GET DIAGNOSTICS n=ROW_COUNT;
 UPDATE public.library_sites SET last_snapshot_at=greatest(last_snapshot_at,(p_snapshot->>'captured_at')::timestamptz),last_change_at=CASE WHEN n>0 THEN greatest(last_change_at,(p_snapshot->>'captured_at')::timestamptz) ELSE last_change_at END,pages=coalesce(pages,'{}'::jsonb)||coalesce(p_snapshot->'discovered_pages','{}'::jsonb) WHERE domain=p_snapshot->>'domain';
 RETURN jsonb_build_object('inserted',1,'events',n);
END; $$;
REVOKE ALL ON FUNCTION public.library_store_snapshot(jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_store_snapshot(jsonb,jsonb,jsonb) TO service_role;