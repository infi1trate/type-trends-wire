ALTER TABLE public.trendsetters ADD COLUMN sector text;
CREATE OR REPLACE VIEW public.trendsetters_latest WITH (security_invoker = on) AS
 SELECT t.run_id, t.domain, t.rank, t.score, t.traits_led, t.sector FROM public.trendsetters t WHERE t.run_id = (SELECT max(id) FROM public.forecast_runs WHERE status = 'ok');