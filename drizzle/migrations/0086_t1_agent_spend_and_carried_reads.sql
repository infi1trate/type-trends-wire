CREATE TABLE public.agent_spend (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  usd numeric NOT NULL CHECK (usd > 0 AND usd <= 10000),
  what text NOT NULL CHECK (char_length(btrim(what)) BETWEEN 3 AND 300),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40)
);
GRANT ALL ON public.agent_spend TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.agent_spend_id_seq TO service_role;
ALTER TABLE public.agent_spend ENABLE ROW LEVEL SECURITY;
CREATE INDEX agent_spend_at_idx ON public.agent_spend (at);

CREATE OR REPLACE FUNCTION public.agent_spend_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'agent_spend is insert-only'; END; $$;
CREATE TRIGGER agent_spend_insert_only BEFORE UPDATE OR DELETE ON public.agent_spend FOR EACH ROW EXECUTE FUNCTION public.agent_spend_insert_only();

ALTER TABLE public.library_tags ADD COLUMN carried_from timestamptz NULL;

CREATE OR REPLACE FUNCTION public.spend_week_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'America/New_York')) AT TIME ZONE 'America/New_York' AS start)
  SELECT jsonb_build_object(
    'week_start', (SELECT start FROM w),
    'model_usd', (SELECT coalesce(round(sum(u.est_cost_usd), 4), 0) FROM public.ai_usage u, w WHERE u.created_at >= w.start AND u.state <> 'rejected'),
    'build_credits', (SELECT coalesce(sum(s.credits), 0) FROM public.spend_entries s, w WHERE s.at >= w.start),
    'agent_usd', (SELECT coalesce(sum(a.usd), 0) FROM public.agent_spend a, w WHERE a.at >= w.start));
$$;
REVOKE ALL ON FUNCTION public.spend_week_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_week_facts() TO anon, authenticated, service_role;