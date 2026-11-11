ALTER TABLE public.library_ai_jobs ADD COLUMN validation_failures integer NOT NULL DEFAULT 0, ADD COLUMN validation_error text;
CREATE FUNCTION public.library_ai_worker_acquire(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE active_backfill boolean;
BEGIN
 UPDATE public.library_ai_control SET lease_token=p_token,lease_until=now()+interval '90 seconds',paused=CASE WHEN reason IN ('rate_limited','unknown_outcome','usage_unknown') THEN false ELSE paused END,reason=CASE WHEN reason IN ('rate_limited','unknown_outcome','usage_unknown') THEN NULL ELSE reason END WHERE name='text' AND (NOT paused OR reason IN ('rate_limited','unknown_outcome','usage_unknown')) AND (lease_until IS NULL OR lease_until<now());
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'cap',0); END IF;
 UPDATE public.ai_usage u SET state='done',ok=false,error='unknown_outcome' FROM public.library_ai_jobs j WHERE u.snapshot_id=j.snapshot_id AND u.kind=j.kind AND u.state IN ('reserved','unknown') AND ((j.status='error' AND j.error IN ('unknown_outcome','usage_unknown')) OR (j.status='pending' AND j.claimed_at IS NOT NULL AND j.lease_token IS DISTINCT FROM p_token));
 UPDATE public.library_ai_jobs SET status=CASE WHEN attempts<3 THEN 'pending' ELSE 'error' END,error='unknown_outcome',done_at=CASE WHEN attempts<3 THEN NULL ELSE now() END,claimed_at=NULL,lease_token=NULL WHERE (status='error' AND error IN ('unknown_outcome','usage_unknown') AND attempts<3) OR (status='pending' AND claimed_at IS NOT NULL AND lease_token IS DISTINCT FROM p_token);
 SELECT EXISTS(SELECT 1 FROM public.ai_budget WHERE scope='backfill' AND active AND (ends_at IS NULL OR ends_at>now())) INTO active_backfill;
 RETURN jsonb_build_object('ok',true,'cap',CASE WHEN active_backfill THEN 25 ELSE 10 END);
END; $$;
CREATE FUNCTION public.library_ai_worker_next(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 PERFORM 1 FROM public.library_ai_control WHERE name='text' AND lease_token=p_token AND lease_until>now() AND NOT paused FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 WITH selected AS (SELECT j.id FROM public.library_ai_jobs j JOIN public.library_snapshots s ON s.id=j.snapshot_id WHERE j.status='pending' AND j.claimed_at IS NULL AND j.attempts<3 AND NOT EXISTS(SELECT 1 FROM public.library_ai_jobs busy JOIN public.library_snapshots bs ON bs.id=busy.snapshot_id WHERE busy.status='pending' AND busy.claimed_at IS NOT NULL AND bs.domain=s.domain AND bs.page_type=s.page_type AND bs.viewport=s.viewport) ORDER BY s.captured_at,s.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED), claimed AS (UPDATE public.library_ai_jobs j SET claimed_at=now(),lease_token=p_token,attempts=attempts+1 FROM selected x WHERE j.id=x.id RETURNING j.*) SELECT to_jsonb(c) INTO result FROM claimed c;
 RETURN result;
END; $$;
CREATE FUNCTION public.library_ai_worker_retry(p_job bigint,p_token uuid,p_code text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM public.library_ai_jobs WHERE id=p_job AND lease_token=p_token AND status='pending' FOR UPDATE;
 IF NOT FOUND OR p_code NOT IN ('unknown_outcome','usage_unknown','run_deadline') THEN RETURN false; END IF;
 UPDATE public.ai_usage u SET state='done',ok=false,error=p_code FROM public.library_ai_jobs j WHERE j.id=p_job AND u.snapshot_id=j.snapshot_id AND u.kind=j.kind AND u.state IN ('reserved','unknown');
 UPDATE public.library_ai_jobs SET status=CASE WHEN attempts<3 THEN 'pending' ELSE 'error' END,error=p_code,done_at=CASE WHEN attempts<3 THEN NULL ELSE now() END,claimed_at=NULL,lease_token=NULL WHERE id=p_job;
 RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.library_ai_worker_acquire(uuid),public.library_ai_worker_next(uuid),public.library_ai_worker_retry(bigint,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.library_ai_worker_acquire(uuid),public.library_ai_worker_next(uuid),public.library_ai_worker_retry(bigint,uuid,text) TO service_role;