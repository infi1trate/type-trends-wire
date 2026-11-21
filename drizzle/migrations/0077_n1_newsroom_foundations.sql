CREATE OR REPLACE FUNCTION public.newsroom_refuse_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: rows are never updated or deleted', TG_TABLE_NAME;
END $$;

-- 1 · The desk log: every call through the door, allowed or refused.
CREATE TABLE public.desk_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 40),
  level text CHECK (level IN ('ships alone', 'ships to preview', 'needs the owner')),
  subject_kind text CHECK (subject_kind IN ('story', 'study', 'pitch', 'edition', 'setting', 'switch', 'spend', 'week', 'none')),
  subject_id text CHECK (char_length(subject_id) <= 200),
  decision text NOT NULL CHECK (decision IN ('done', 'proposed', 'refused', 'read', 'failed')),
  reason text CHECK (char_length(reason) <= 600),
  edit_id bigint,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(detail) <= 8192),
  CONSTRAINT desk_log_reason CHECK ((decision <> 'refused' AND action NOT IN ('kill', 'hold', 'retire')) OR (reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.desk_log TO service_role;
ALTER TABLE public.desk_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_log_at_idx ON public.desk_log (at DESC);
CREATE INDEX desk_log_actor_at_idx ON public.desk_log (actor, at DESC);
CREATE INDEX desk_log_edit_idx ON public.desk_log (edit_id) WHERE edit_id IS NOT NULL;
CREATE TRIGGER desk_log_insert_only BEFORE UPDATE OR DELETE ON public.desk_log FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- The history as one list: the desk log, plus every story_edits row no logged call wrote.
CREATE VIEW public.desk_history WITH (security_invoker = true) AS
SELECT 'log:' || l.id AS ref, l.at, l.actor, l.action, l.level, l.subject_kind, l.subject_id, l.decision, l.reason, 'desk_log'::text AS source
FROM public.desk_log l
UNION ALL
SELECT 'edit:' || e.id, e.at,
  CASE WHEN e.note ~ '^(Retired:|Re-planned:|Held:|Folded:|Updated [0-9]|Reworded)' THEN 'engine' ELSE 'editor' END,
  CASE WHEN e.action = 'kill' AND e.note LIKE 'Retired:%' THEN 'retire' WHEN e.action = 'kill' AND e.note LIKE 'Held:%' THEN 'hold' ELSE e.action END,
  'ships alone', 'story', e.story_id, 'done', coalesce(e.payload->>'reason', e.note), 'story_edits'
FROM public.story_edits e
WHERE NOT EXISTS (SELECT 1 FROM public.desk_log l WHERE l.edit_id = e.id);
GRANT SELECT ON public.desk_history TO service_role;

-- 1.6 · The board: which desk holds a pitch, and its status (beside the pitches tables; append-only, latest row wins).
CREATE TABLE public.pitch_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pitch_id bigint NOT NULL REFERENCES public.pitches(id),
  desk text NOT NULL CHECK (char_length(desk) BETWEEN 1 AND 40),
  status text NOT NULL CHECK (status IN ('open', 'assigned', 'working', 'done', 'dropped')),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  reason text CHECK (char_length(reason) <= 300),
  at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pitch_assignments_reason CHECK (status <> 'dropped' OR (reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.pitch_assignments TO service_role;
ALTER TABLE public.pitch_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX pitch_assignments_pitch_idx ON public.pitch_assignments (pitch_id, id DESC);
CREATE TRIGGER pitch_assignments_insert_only BEFORE UPDATE OR DELETE ON public.pitch_assignments FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- 2 · Story state history, separate from stories.status. `ref` names the stored row a state was read from, so it is written once.
CREATE TABLE public.story_states (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id text NOT NULL REFERENCES public.stories(id),
  state text NOT NULL CHECK (state IN ('candidate', 'drafted', 'checked', 'reviewed', 'published', 'held', 'killed', 'retired')),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  reason text CHECK (char_length(reason) <= 600),
  at timestamptz NOT NULL,
  ref text NOT NULL UNIQUE CHECK (char_length(ref) <= 300),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT story_states_reason CHECK (state NOT IN ('held', 'killed', 'retired') OR (reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.story_states TO service_role;
ALTER TABLE public.story_states ENABLE ROW LEVEL SECURITY;
CREATE INDEX story_states_story_idx ON public.story_states (story_id, at, id);
CREATE INDEX story_states_at_idx ON public.story_states (at DESC);
CREATE TRIGGER story_states_insert_only BEFORE UPDATE OR DELETE ON public.story_states FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- 4 · Spend: build credits entered through the desk, and the owner's weekly cap (latest row wins; both numbers null = no cap).
CREATE TABLE public.spend_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'build' CHECK (kind = 'build'),
  credits numeric NOT NULL CHECK (credits > 0 AND credits <= 100000),
  what text NOT NULL CHECK (char_length(btrim(what)) BETWEEN 3 AND 300),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40)
);
GRANT ALL ON public.spend_entries TO service_role;
ALTER TABLE public.spend_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX spend_entries_at_idx ON public.spend_entries (at DESC);
CREATE TRIGGER spend_entries_insert_only BEFORE UPDATE OR DELETE ON public.spend_entries FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.spend_caps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  model_usd numeric CHECK (model_usd IS NULL OR (model_usd >= 0 AND model_usd <= 100000)),
  build_credits numeric CHECK (build_credits IS NULL OR (build_credits >= 0 AND build_credits <= 1000000)),
  actor text NOT NULL CHECK (actor = 'owner'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300)
);
GRANT ALL ON public.spend_caps TO service_role;
ALTER TABLE public.spend_caps ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER spend_caps_insert_only BEFORE UPDATE OR DELETE ON public.spend_caps FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- The ledger as one list: model spend summed from ai_usage per Eastern-time day, kind and model (rejected reservations excluded),
-- plus the build entries.
CREATE VIEW public.spend_ledger WITH (security_invoker = true) AS
SELECT 'model'::text AS kind, (u.created_at AT TIME ZONE 'America/New_York')::date AS day, u.kind || ' · ' || u.model AS what,
  count(*)::integer AS calls, round(sum(u.est_cost_usd)::numeric, 6) AS usd, NULL::numeric AS credits, 'ai_usage'::text AS actor
FROM public.ai_usage u WHERE u.state <> 'rejected'
GROUP BY 2, 3, u.kind, u.model
UNION ALL
SELECT 'build', (s.at AT TIME ZONE 'America/New_York')::date, s.what, NULL, NULL, s.credits, s.actor FROM public.spend_entries s;
GRANT SELECT ON public.spend_ledger TO service_role;

-- This week's spend (Monday 00:00 to Sunday 24:00, America/New_York) and the cap, for the desk and the writers.
CREATE OR REPLACE FUNCTION public.spend_status() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH w AS (SELECT (date_trunc('week', now() AT TIME ZONE 'America/New_York')) AT TIME ZONE 'America/New_York' AS start),
  m AS (SELECT u.kind, u.model, count(*)::integer AS calls, coalesce(sum(u.est_cost_usd), 0)::numeric AS usd FROM public.ai_usage u, w WHERE u.created_at >= w.start AND u.state <> 'rejected' GROUP BY u.kind, u.model),
  c AS (SELECT model_usd, build_credits, at FROM public.spend_caps ORDER BY id DESC LIMIT 1)
  SELECT jsonb_build_object(
    'week_start', (SELECT start FROM w),
    'model_usd', (SELECT coalesce(sum(usd), 0) FROM m),
    'build_credits', (SELECT coalesce(sum(s.credits), 0) FROM public.spend_entries s, w WHERE s.at >= w.start),
    'by_kind', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'model', model, 'calls', calls, 'usd', round(usd, 6)) ORDER BY usd DESC) FROM m), '[]'::jsonb),
    'cap', (SELECT CASE WHEN model_usd IS NULL AND build_credits IS NULL THEN NULL ELSE jsonb_build_object('model_usd', model_usd, 'build_credits', build_credits, 'set_at', at) END FROM c));
$$;
REVOKE ALL ON FUNCTION public.spend_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_status() TO service_role;

-- Public facade for health: whether a cap is set and whether this week reached it (either number at or over its cap). No amounts.
CREATE OR REPLACE FUNCTION public.spend_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (SELECT public.spend_status() AS j)
  SELECT jsonb_build_object(
    'week_start', j->'week_start',
    'cap_set', j->'cap' IS NOT NULL AND j->'cap' <> 'null'::jsonb,
    'reached', CASE WHEN j->'cap' IS NULL OR j->'cap' = 'null'::jsonb THEN false
      ELSE ((j->'cap'->>'model_usd') IS NOT NULL AND (j->>'model_usd')::numeric >= (j->'cap'->>'model_usd')::numeric)
        OR ((j->'cap'->>'build_credits') IS NOT NULL AND (j->>'build_credits')::numeric >= (j->'cap'->>'build_credits')::numeric) END)
  FROM s;
$$;
REVOKE ALL ON FUNCTION public.spend_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_facts() TO anon, authenticated, service_role;

-- 3.6 · Switches set through the door (latest row wins). Only "wire only" exists; it starts off (no row).
CREATE TABLE public.desk_switches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name IN ('wire_only')),
  is_on boolean NOT NULL,
  actor text NOT NULL CHECK (actor = 'owner'),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300),
  at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.desk_switches TO service_role;
ALTER TABLE public.desk_switches ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_switches_name_idx ON public.desk_switches (name, id DESC);
CREATE TRIGGER desk_switches_insert_only BEFORE UPDATE OR DELETE ON public.desk_switches FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE OR REPLACE FUNCTION public.desk_switch_on(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT is_on FROM public.desk_switches WHERE name = p_name ORDER BY id DESC LIMIT 1), false);
$$;
REVOKE ALL ON FUNCTION public.desk_switch_on(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.desk_switch_on(text) TO anon, authenticated, service_role;