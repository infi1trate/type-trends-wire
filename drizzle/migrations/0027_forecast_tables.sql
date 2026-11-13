CREATE TABLE public.forecast_runs (
 id bigserial PRIMARY KEY,
 computed_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','error')),
 data_cutoff_quarter text,
 coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
 model_card jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE public.forecasts (
 id bigserial PRIMARY KEY,
 run_id bigint NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
 computed_at timestamptz NOT NULL DEFAULT now(),
 dimension text NOT NULL, value text NOT NULL, scope text NOT NULL,
 status text NOT NULL, stage text, model text,
 current_share double precision,
 proj_q1 double precision, proj_q1_lo double precision, proj_q1_hi double precision,
 proj_q2 double precision, proj_q2_lo double precision, proj_q2_hi double precision,
 proj_q4 double precision, proj_q4_lo double precision, proj_q4_hi double precision,
 momentum double precision, next_wave_score double precision,
 components jsonb NOT NULL DEFAULT '{}'::jsonb,
 evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
 backtest jsonb NOT NULL DEFAULT '{}'::jsonb,
 UNIQUE (run_id, dimension, value, scope)
);
CREATE INDEX forecasts_run_scope_idx ON public.forecasts(run_id, scope, next_wave_score DESC);
CREATE TABLE public.trendsetters (
 run_id bigint NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
 domain text NOT NULL, rank integer NOT NULL, score double precision NOT NULL,
 traits_led jsonb NOT NULL DEFAULT '[]'::jsonb,
 PRIMARY KEY (run_id, domain)
);
CREATE TABLE public.weekly_briefs (
 week text PRIMARY KEY,
 run_id bigint REFERENCES public.forecast_runs(id) ON DELETE SET NULL,
 brief jsonb NOT NULL, model text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forecast_runs, public.forecasts, public.trendsetters, public.weekly_briefs TO anon, authenticated;
GRANT ALL ON public.forecast_runs, public.forecasts, public.trendsetters, public.weekly_briefs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.forecast_runs_id_seq, public.forecasts_id_seq TO service_role;
ALTER TABLE public.forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trendsetters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads finished forecast runs" ON public.forecast_runs FOR SELECT TO anon, authenticated USING (status = 'ok');
CREATE POLICY "Public reads forecasts of finished runs" ON public.forecasts FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.forecast_runs r WHERE r.id = run_id AND r.status = 'ok'));
CREATE POLICY "Public reads trendsetters of finished runs" ON public.trendsetters FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.forecast_runs r WHERE r.id = run_id AND r.status = 'ok'));
CREATE POLICY "Public reads weekly briefs" ON public.weekly_briefs FOR SELECT TO anon, authenticated USING (brief IS NOT NULL);
CREATE VIEW public.forecast_model_card WITH (security_invoker = on) AS
 SELECT id AS run_id, computed_at, data_cutoff_quarter, coverage, model_card FROM public.forecast_runs WHERE status = 'ok' ORDER BY id DESC LIMIT 1;
CREATE VIEW public.forecast_latest WITH (security_invoker = on) AS
 SELECT f.* FROM public.forecasts f WHERE f.run_id = (SELECT max(id) FROM public.forecast_runs WHERE status = 'ok');
CREATE VIEW public.trendsetters_latest WITH (security_invoker = on) AS
 SELECT t.* FROM public.trendsetters t WHERE t.run_id = (SELECT max(id) FROM public.forecast_runs WHERE status = 'ok');
GRANT SELECT ON public.forecast_model_card, public.forecast_latest, public.trendsetters_latest TO anon, authenticated, service_role;
ALTER TABLE public.ai_usage DROP CONSTRAINT ai_usage_kind_check;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check CHECK (kind = ANY (ARRAY['vision','pricing','changelog','product','brief']));