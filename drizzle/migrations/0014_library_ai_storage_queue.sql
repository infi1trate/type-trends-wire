CREATE TABLE public.library_tags(snapshot_id bigint PRIMARY KEY REFERENCES public.library_snapshots(id) ON DELETE CASCADE,domain text NOT NULL REFERENCES public.library_sites(domain),signals_hash text NOT NULL,model text NOT NULL,tags jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.library_tags TO anon,authenticated; GRANT ALL ON public.library_tags TO service_role; ALTER TABLE public.library_tags ENABLE ROW LEVEL SECURITY; CREATE POLICY "public read" ON public.library_tags FOR SELECT TO anon,authenticated USING(true);
CREATE INDEX library_tags_reuse_idx ON public.library_tags(domain,signals_hash,created_at DESC);
CREATE TABLE public.library_extractions(snapshot_id bigint PRIMARY KEY REFERENCES public.library_snapshots(id) ON DELETE CASCADE,domain text NOT NULL REFERENCES public.library_sites(domain),kind text NOT NULL CHECK(kind IN ('pricing','changelog','product')),model text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.library_extractions TO anon,authenticated; GRANT ALL ON public.library_extractions TO service_role; ALTER TABLE public.library_extractions ENABLE ROW LEVEL SECURITY; CREATE POLICY "public read" ON public.library_extractions FOR SELECT TO anon,authenticated USING(true);
CREATE TABLE public.library_ai_jobs(id bigserial PRIMARY KEY,snapshot_id bigint NOT NULL UNIQUE REFERENCES public.library_snapshots(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('pricing','changelog','product')),status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','done','error','skipped')),attempts integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),done_at timestamptz,error text,claimed_at timestamptz,lease_token uuid);
GRANT ALL ON public.library_ai_jobs TO service_role; REVOKE ALL ON public.library_ai_jobs FROM anon,authenticated; ALTER TABLE public.library_ai_jobs ENABLE ROW LEVEL SECURITY; GRANT USAGE,SELECT ON SEQUENCE public.library_ai_jobs_id_seq TO service_role;
CREATE INDEX library_ai_jobs_pending_idx ON public.library_ai_jobs(created_at) WHERE status='pending';
CREATE TABLE public.library_ai_control(name text PRIMARY KEY,paused boolean NOT NULL DEFAULT false,reason text,lease_until timestamptz,lease_token uuid,rate_limits integer NOT NULL DEFAULT 0);
GRANT ALL ON public.library_ai_control TO service_role; REVOKE ALL ON public.library_ai_control FROM anon,authenticated; ALTER TABLE public.library_ai_control ENABLE ROW LEVEL SECURITY;
CREATE VIEW public.library_ai_status AS SELECT name,paused,reason FROM public.library_ai_control; GRANT SELECT ON public.library_ai_status TO anon,authenticated;
CREATE TABLE public.library_ai_baselines(domain text NOT NULL REFERENCES public.library_sites(domain),page_type text NOT NULL,viewport text NOT NULL,kind text NOT NULL,signals jsonb NOT NULL,pending jsonb NOT NULL DEFAULT '{}',snapshot_id bigint,last_snapshot_id bigint,captured_at timestamptz NOT NULL,confirmed_at timestamptz NOT NULL,PRIMARY KEY(domain,page_type,viewport,kind));
GRANT ALL ON public.library_ai_baselines TO service_role; REVOKE ALL ON public.library_ai_baselines FROM anon,authenticated; ALTER TABLE public.library_ai_baselines ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.library_enqueue_text() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.library_snapshots; prev public.library_snapshots; extraction public.library_extractions;
BEGIN
 SELECT * INTO s FROM public.library_snapshots WHERE id=NEW.snapshot_id;
 IF s.viewport<>'desktop' OR s.source<>'live' OR s.page_type NOT IN ('pricing','changelog','product') OR length(coalesce(NEW.raw_text,''))=0 THEN RETURN NEW; END IF;
 SELECT * INTO prev FROM public.library_snapshots WHERE domain=s.domain AND page_type=s.page_type AND viewport=s.viewport AND source=s.source AND captured_at<s.captured_at ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF s.content_hash IS NOT NULL AND s.content_hash=prev.content_hash THEN
 SELECT * INTO extraction FROM public.library_extractions WHERE snapshot_id=prev.id;
 IF FOUND THEN INSERT INTO public.library_extractions(snapshot_id,domain,kind,model,data) VALUES(s.id,s.domain,s.page_type,extraction.model,extraction.data) ON CONFLICT DO NOTHING; RETURN NEW; END IF;
 END IF;
 INSERT INTO public.library_ai_jobs(snapshot_id,kind) VALUES(s.id,s.page_type) ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
CREATE TRIGGER library_text_enqueue AFTER INSERT ON public.library_snapshot_text FOR EACH ROW EXECUTE FUNCTION public.library_enqueue_text();
REVOKE ALL ON FUNCTION public.library_enqueue_text() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.library_ai_claim(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE jobs jsonb;
BEGIN
 INSERT INTO public.library_ai_control(name) VALUES('text') ON CONFLICT DO NOTHING;
 UPDATE public.library_ai_control SET lease_until=now()+interval '4 minutes',lease_token=p_token WHERE name='text' AND NOT paused AND (lease_until IS NULL OR lease_until<now());
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'jobs','[]'::jsonb); END IF;
 UPDATE public.library_ai_jobs SET status='error',error='unknown_outcome',done_at=now() WHERE status='pending' AND claimed_at IS NOT NULL AND claimed_at<now()-interval '4 minutes';
 WITH selected AS (SELECT id FROM public.library_ai_jobs WHERE status='pending' AND claimed_at IS NULL ORDER BY created_at,id LIMIT 10 FOR UPDATE SKIP LOCKED), claimed AS (UPDATE public.library_ai_jobs j SET claimed_at=now(),lease_token=p_token,attempts=attempts+1 FROM selected x WHERE j.id=x.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO jobs FROM claimed c;
 RETURN jsonb_build_object('ok',true,'jobs',jobs);
END; $$;
CREATE FUNCTION public.library_ai_release(p_token uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ UPDATE public.library_ai_control SET lease_until=NULL,lease_token=NULL WHERE name='text' AND lease_token=p_token; $$;
CREATE FUNCTION public.library_ai_complete(p_job bigint,p_token uuid,p_snapshot bigint,p_domain text,p_kind text,p_model text,p_data jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.library_ai_jobs WHERE id=p_job AND snapshot_id=p_snapshot AND status='pending' AND lease_token=p_token FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 INSERT INTO public.library_extractions(snapshot_id,domain,kind,model,data) VALUES(p_snapshot,p_domain,p_kind,p_model,p_data) ON CONFLICT DO NOTHING;
 UPDATE public.library_ai_jobs SET status='done',done_at=now(),error=NULL WHERE id=p_job;
 RETURN true;
END; $$;
CREATE FUNCTION public.library_ai_store(p_snapshot bigint,p_kind text,p_model text,p_data jsonb,p_expected jsonb,p_state jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.library_snapshots; current_state jsonb;
BEGIN
 SELECT * INTO s FROM public.library_snapshots WHERE id=p_snapshot;
 IF NOT FOUND OR s.source<>'live' OR s.viewport<>'desktop' OR (p_kind='vision' AND s.page_type<>'home') THEN RAISE EXCEPTION 'Ineligible AI snapshot'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(s.domain||':ai:'||p_kind||':'||s.page_type,0));
 SELECT to_jsonb(b) INTO current_state FROM public.library_ai_baselines b WHERE domain=s.domain AND page_type=s.page_type AND viewport=s.viewport AND kind=p_kind;
 IF current_state IS DISTINCT FROM p_expected THEN RETURN false; END IF;
 IF p_kind='vision' THEN INSERT INTO public.library_tags(snapshot_id,domain,signals_hash,model,tags) VALUES(s.id,s.domain,s.signals_hash,p_model,p_data) ON CONFLICT DO NOTHING;
 ELSE INSERT INTO public.library_extractions(snapshot_id,domain,kind,model,data) VALUES(s.id,s.domain,p_kind,p_model,p_data) ON CONFLICT DO NOTHING; END IF;
 IF current_state IS NOT NULL AND (s.captured_at<=(current_state->>'captured_at')::timestamptz OR s.id=(current_state->>'last_snapshot_id')::bigint) THEN RETURN true; END IF;
 INSERT INTO public.library_ai_baselines(domain,page_type,viewport,kind,signals,pending,snapshot_id,last_snapshot_id,captured_at,confirmed_at) VALUES(s.domain,s.page_type,s.viewport,p_kind,p_state#>'{baseline,signals}',coalesce(p_state->'pending','{}'::jsonb),coalesce((p_state#>>'{baseline,snapshot_id}')::bigint,s.id),s.id,s.captured_at,(p_state#>>'{baseline,confirmed_at}')::timestamptz) ON CONFLICT(domain,page_type,viewport,kind) DO UPDATE SET signals=excluded.signals,pending=excluded.pending,snapshot_id=excluded.snapshot_id,last_snapshot_id=excluded.last_snapshot_id,captured_at=excluded.captured_at,confirmed_at=excluded.confirmed_at;
 INSERT INTO public.library_events(domain,page_type,viewport,effective_at,type,severity,summary,before,after,prev_snapshot_id,snapshot_id) SELECT s.domain,s.page_type,s.viewport,(e->>'effective_at')::timestamptz,e->>'type',(e->>'severity')::smallint,'AI · '||(e->>'summary'),e->'before',e->'after',(e->>'prev_snapshot_id')::bigint,s.id FROM jsonb_array_elements(p_state->'events') e;
 IF jsonb_array_length(p_state->'events')>0 THEN UPDATE public.library_sites SET last_change_at=greatest(last_change_at,s.captured_at) WHERE domain=s.domain; END IF;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.library_ai_claim(uuid),public.library_ai_release(uuid),public.library_ai_complete(bigint,uuid,bigint,text,text,text,jsonb),public.library_ai_store(bigint,text,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_ai_claim(uuid),public.library_ai_release(uuid),public.library_ai_complete(bigint,uuid,bigint,text,text,text,jsonb),public.library_ai_store(bigint,text,text,jsonb,jsonb,jsonb) TO service_role;