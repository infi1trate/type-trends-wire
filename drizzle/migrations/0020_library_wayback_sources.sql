ALTER TABLE public.library_events ADD COLUMN source text NOT NULL DEFAULT 'live' CHECK(source IN ('live','wayback'));
UPDATE public.library_events e SET source=s.source FROM public.library_snapshots s WHERE e.snapshot_id=s.id;
CREATE INDEX library_snapshots_source_key_idx ON public.library_snapshots(domain,page_type,viewport,source,captured_at DESC,id DESC);
CREATE INDEX library_events_source_time_idx ON public.library_events(source,detected_at DESC);
CREATE FUNCTION public.library_event_source() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.source:=coalesce((SELECT source FROM public.library_snapshots WHERE id=NEW.snapshot_id),NEW.source); RETURN NEW; END; $$;
CREATE TRIGGER library_event_source BEFORE INSERT ON public.library_events FOR EACH ROW EXECUTE FUNCTION public.library_event_source();
REVOKE ALL ON FUNCTION public.library_event_source() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.library_snapshot_context(jsonb)'::regprocedure);
 definition:=replace(definition,'''new_surface'',NOT EXISTS','''new_surface'',p_snapshot->>''source''=''live'' AND NOT EXISTS');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.library_store_snapshot(jsonb,jsonb,jsonb)'::regprocedure);
 definition:=replace(definition,'IF p_snapshot ? ''raw_text'' THEN','IF p_snapshot->>''source''=''live'' AND p_snapshot ? ''raw_text'' THEN');
 definition:=replace(definition,'WHERE domain=p_snapshot->>''domain'';','WHERE domain=p_snapshot->>''domain'' AND p_snapshot->>''source''=''live'';');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.library_ai_store(bigint,text,text,jsonb,jsonb,jsonb)'::regprocedure);
 definition:=replace(definition,'s.source<>''live'' OR','(s.source<>''live'' AND p_kind<>''vision'') OR');
 definition:=replace(definition,'current_state jsonb;','current_state jsonb; baseline_kind text;');
 definition:=replace(definition,'PERFORM pg_advisory_xact_lock','baseline_kind:=CASE WHEN s.source=''wayback'' THEN p_kind||'':wayback'' ELSE p_kind END; PERFORM pg_advisory_xact_lock');
 definition:=replace(definition,'s.domain||'':ai:''||p_kind','s.domain||'':ai:''||baseline_kind');
 definition:=replace(definition,'kind=p_kind;','kind=baseline_kind;');
 definition:=replace(definition,'VALUES(s.domain,s.page_type,s.viewport,p_kind,p_state','VALUES(s.domain,s.page_type,s.viewport,baseline_kind,p_state');
 definition:=replace(definition,'WHERE domain=s.domain;','WHERE domain=s.domain AND s.source=''live'';');
 EXECUTE definition;
 definition:=pg_get_viewdef('public.library_latest'::regclass,true);
 definition:=replace(definition,'e.domain = s.domain AND','e.domain = s.domain AND e.source = ''live'' AND');
 EXECUTE 'CREATE OR REPLACE VIEW public.library_latest WITH(security_invoker=true) AS '||definition;
 END $$;
CREATE OR REPLACE FUNCTION public.library_state() RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
WITH latest AS (SELECT DISTINCT ON(domain,page_type,viewport) domain,page_type,viewport,html_hash,content_hash,signals_hash,captured_at FROM public.library_snapshots WHERE source='live' ORDER BY domain,page_type,viewport,captured_at DESC,id DESC),
hashes AS (SELECT domain,jsonb_object_agg(page_type||':'||viewport,jsonb_build_object('html_hash',html_hash,'content_hash',content_hash,'signals_hash',signals_hash,'captured_at',captured_at)) latest FROM latest GROUP BY domain),
archives AS (SELECT domain,jsonb_agg(captured_at ORDER BY captured_at) wayback FROM public.library_snapshots WHERE source='wayback' AND page_type='home' AND viewport='desktop' GROUP BY domain)
SELECT jsonb_build_object('sites',coalesce(jsonb_agg(jsonb_build_object('domain',s.domain,'sector',s.sector,'active',s.active,'pages',s.pages,'latest',coalesce(h.latest,'{}'::jsonb),'wayback',coalesce(a.wayback,'[]'::jsonb)) ORDER BY s.domain),'[]'::jsonb)) FROM public.library_sites s LEFT JOIN hashes h USING(domain) LEFT JOIN archives a USING(domain) WHERE s.active=true; $$;
CREATE OR REPLACE VIEW public.library_event_feed WITH(security_invoker=true) AS SELECT e.id,e.domain,e.page_type,e.viewport,e.detected_at,e.effective_at,e.type,e.severity,e.summary,e.before,e.after,e.prev_snapshot_id,e.snapshot_id,s.sector,e.source FROM public.library_events e JOIN public.library_sites s USING(domain) WHERE e.source='live' ORDER BY e.detected_at DESC,e.id DESC LIMIT 200;
REVOKE ALL ON FUNCTION public.library_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_state() TO service_role;