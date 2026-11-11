CREATE OR REPLACE FUNCTION public.library_enqueue_text() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.library_snapshots; prev public.library_snapshots; extraction public.library_extractions;
BEGIN
 SELECT * INTO s FROM public.library_snapshots WHERE id=NEW.snapshot_id;
 IF s.viewport<>'desktop' OR s.source<>'live' OR s.page_type NOT IN ('pricing','changelog','product') OR length(coalesce(NEW.raw_text,''))=0 THEN RETURN NEW; END IF;
 SELECT * INTO prev FROM public.library_snapshots WHERE domain=s.domain AND page_type=s.page_type AND viewport=s.viewport AND source=s.source AND captured_at<s.captured_at ORDER BY captured_at DESC,id DESC LIMIT 1;
 IF s.content_hash IS NOT NULL AND s.content_hash=prev.content_hash THEN
 SELECT * INTO extraction FROM public.library_extractions WHERE snapshot_id=prev.id;
 IF FOUND THEN INSERT INTO public.library_extractions(snapshot_id,domain,kind,model,data) VALUES(s.id,s.domain,s.page_type,extraction.model,extraction.data) ON CONFLICT DO NOTHING; END IF;
 END IF;
 -- Existing copied output is reconciled through advance without an inference call.
 INSERT INTO public.library_ai_jobs(snapshot_id,kind) VALUES(s.id,s.page_type) ON CONFLICT DO NOTHING;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.library_ai_claim(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE jobs jsonb;
BEGIN
 INSERT INTO public.library_ai_control(name) VALUES('text') ON CONFLICT DO NOTHING;
 UPDATE public.library_ai_control SET lease_until=now()+interval '4 minutes',lease_token=p_token,paused=CASE WHEN reason='rate_limited' THEN false ELSE paused END,reason=CASE WHEN reason='rate_limited' THEN NULL ELSE reason END WHERE name='text' AND (NOT paused OR reason='rate_limited') AND (lease_until IS NULL OR lease_until<now());
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'jobs','[]'::jsonb); END IF;
 UPDATE public.library_ai_jobs SET status='error',error='unknown_outcome',done_at=now() WHERE status='pending' AND claimed_at IS NOT NULL AND claimed_at<now()-interval '4 minutes';
 WITH selected AS (SELECT j.id FROM public.library_ai_jobs j JOIN public.library_snapshots s ON s.id=j.snapshot_id WHERE j.status='pending' AND j.claimed_at IS NULL ORDER BY s.captured_at,s.id LIMIT 10 FOR UPDATE OF j SKIP LOCKED), claimed AS (UPDATE public.library_ai_jobs j SET claimed_at=now(),lease_token=p_token,attempts=attempts+1 FROM selected x WHERE j.id=x.id RETURNING j.*)
 SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY s.captured_at,s.id),'[]'::jsonb) INTO jobs FROM claimed c JOIN public.library_snapshots s ON s.id=c.snapshot_id;
 RETURN jsonb_build_object('ok',true,'jobs',jobs);
END; $$;
REVOKE ALL ON FUNCTION public.library_enqueue_text(),public.library_ai_claim(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_ai_claim(uuid) TO service_role;