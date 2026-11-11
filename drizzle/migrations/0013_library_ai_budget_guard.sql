CREATE TABLE public.ai_budget(scope text PRIMARY KEY CHECK(scope IN ('monthly','backfill')),cap_usd numeric NOT NULL CHECK(cap_usd>=0),active boolean NOT NULL DEFAULT true,ends_at timestamptz);
GRANT ALL ON public.ai_budget TO service_role;
REVOKE ALL ON public.ai_budget FROM anon,authenticated;
ALTER TABLE public.ai_budget ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.ai_usage(id bigserial PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now(),kind text NOT NULL CHECK(kind IN ('vision','pricing','changelog','product')),model text NOT NULL,input_tokens bigint,output_tokens bigint,est_cost_usd numeric NOT NULL CHECK(est_cost_usd>=0),snapshot_id bigint REFERENCES public.library_snapshots(id),ok boolean NOT NULL DEFAULT false,error text,scope text NOT NULL REFERENCES public.ai_budget(scope),state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','done','unknown','rejected')));
GRANT ALL ON public.ai_usage TO service_role;
REVOKE ALL ON public.ai_usage FROM anon,authenticated;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
GRANT USAGE,SELECT ON SEQUENCE public.ai_usage_id_seq TO service_role;
CREATE INDEX ai_usage_scope_created_idx ON public.ai_usage(scope,created_at);
CREATE UNIQUE INDEX ai_usage_snapshot_reserved_idx ON public.ai_usage(snapshot_id,kind) WHERE state IN ('reserved','unknown');
CREATE FUNCTION public.ai_reserve(p_snapshot_id bigint,p_kind text,p_model text,p_estimate numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b record; spent numeric; uid bigint;
BEGIN
 IF p_estimate<=0 OR p_estimate>1 THEN RAISE EXCEPTION 'Invalid estimate'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('library-ai-budget',0));
 IF EXISTS(SELECT 1 FROM public.ai_usage WHERE snapshot_id=p_snapshot_id AND kind=p_kind AND state IN ('reserved','unknown')) THEN RETURN jsonb_build_object('ok',false,'code','already_claimed'); END IF;
 FOR b IN SELECT * FROM public.ai_budget WHERE active AND (ends_at IS NULL OR ends_at>now()) ORDER BY CASE scope WHEN 'backfill' THEN 0 ELSE 1 END LOOP
 SELECT coalesce(sum(est_cost_usd),0) INTO spent FROM public.ai_usage WHERE scope=b.scope AND state<>'rejected' AND (b.scope='backfill' OR created_at>=date_trunc('month',now()));
 IF spent+p_estimate<=b.cap_usd THEN INSERT INTO public.ai_usage(kind,model,est_cost_usd,snapshot_id,scope) VALUES(p_kind,p_model,p_estimate,p_snapshot_id,b.scope) RETURNING id INTO uid; RETURN jsonb_build_object('ok',true,'id',uid,'scope',b.scope); END IF;
 END LOOP;
 RETURN jsonb_build_object('ok',false,'code','budget_exhausted');
END; $$;
CREATE FUNCTION public.ai_settle(p_id bigint,p_input bigint,p_output bigint,p_cost numeric,p_ok boolean,p_error text DEFAULT NULL,p_state text DEFAULT 'done') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_cost<0 OR p_input<0 OR p_output<0 OR p_state NOT IN ('done','unknown','rejected') THEN RAISE EXCEPTION 'Invalid usage'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('library-ai-budget',0));
 UPDATE public.ai_usage SET input_tokens=p_input,output_tokens=p_output,est_cost_usd=CASE WHEN p_state='unknown' THEN greatest(est_cost_usd,p_cost) ELSE p_cost END,ok=p_ok,error=left(p_error,120),state=p_state WHERE id=p_id AND state='reserved';
END; $$;
REVOKE ALL ON FUNCTION public.ai_reserve(bigint,text,text,numeric),public.ai_settle(bigint,bigint,bigint,numeric,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ai_reserve(bigint,text,text,numeric),public.ai_settle(bigint,bigint,bigint,numeric,boolean,text,text) TO service_role;
CREATE VIEW public.ai_spend_summary AS SELECT coalesce(sum(u.est_cost_usd) FILTER(WHERE u.created_at>=date_trunc('month',now()) AND u.state<>'rejected'),0) AS month_to_date_usd,coalesce(sum(u.est_cost_usd) FILTER(WHERE u.scope='backfill' AND u.state<>'rejected'),0) AS backfill_usd,(SELECT cap_usd FROM public.ai_budget WHERE scope='monthly') AS monthly_cap_usd,(SELECT cap_usd FROM public.ai_budget WHERE scope='backfill') AS backfill_cap_usd,count(*) FILTER(WHERE u.kind='vision') AS vision_calls,count(*) FILTER(WHERE u.kind='pricing') AS pricing_calls,count(*) FILTER(WHERE u.kind='changelog') AS changelog_calls,count(*) FILTER(WHERE u.kind='product') AS product_calls FROM public.ai_usage u;
GRANT SELECT ON public.ai_spend_summary TO anon,authenticated;