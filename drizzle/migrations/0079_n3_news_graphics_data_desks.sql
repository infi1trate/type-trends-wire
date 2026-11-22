-- N3 · the news, graphics and data desks: wider checks on the desks' existing records, and new append-only records (service role only).
ALTER TABLE public.desk_calls DROP CONSTRAINT desk_calls_desk_check;
ALTER TABLE public.desk_calls ADD CONSTRAINT desk_calls_desk_check CHECK (desk IN ('standards', 'editor in chief', 'news', 'graphics', 'data'));
ALTER TABLE public.desk_calls DROP CONSTRAINT desk_calls_purpose_check;
ALTER TABLE public.desk_calls ADD CONSTRAINT desk_calls_purpose_check CHECK (purpose IN ('review', 'placement', 'fixture', 'picks', 'picture', 'chart', 'proposal'));
ALTER TABLE public.story_reviews DROP CONSTRAINT story_reviews_second_reader_check;
ALTER TABLE public.story_reviews ADD CONSTRAINT story_reviews_second_reader_check CHECK (second_reader IN ('ran', 'cap used', 'call failed', 'time ran out', 'not run', 'overruled'));
ALTER TABLE public.story_states DROP CONSTRAINT story_states_state_check;
ALTER TABLE public.story_states ADD CONSTRAINT story_states_state_check CHECK (state IN ('candidate', 'drafted', 'checked', 'picture checked', 'reviewed', 'published', 'held', 'killed', 'retired'));
ALTER TABLE public.desk_log DROP CONSTRAINT desk_log_subject_kind_check;
ALTER TABLE public.desk_log ADD CONSTRAINT desk_log_subject_kind_check CHECK (subject_kind IN ('story', 'study', 'pitch', 'edition', 'setting', 'switch', 'spend', 'week', 'none', 'wire', 'finding'));
ALTER TABLE public.pitches DROP CONSTRAINT pitches_kind_check;
ALTER TABLE public.pitches ADD CONSTRAINT pitches_kind_check CHECK (kind IN ('change', 'signal', 'brand', 'census', 'receipt', 'study'));
ALTER TABLE public.ai_usage DROP CONSTRAINT ai_usage_kind_check_v2;
ALTER TABLE public.ai_usage ADD CONSTRAINT ai_usage_kind_check_v3 CHECK (kind IN ('vision', 'pricing', 'changelog', 'product', 'brief', 'taste_brief', 'taste_vision', 'taste_fonts', 'story_why', 'desk_vision'));

CREATE TABLE public.wire_picks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  item_id bigint NOT NULL UNIQUE REFERENCES public.wire_items(id),
  subject text NOT NULL CHECK (subject IN ('brand', 'web', 'type')),
  line text NOT NULL CHECK (char_length(btrim(line)) BETWEEN 3 AND 120),
  domain text CHECK (char_length(domain) <= 253),
  actor text NOT NULL CHECK (actor IN ('news', 'owner')),
  call_id bigint REFERENCES public.desk_calls(id)
);
GRANT ALL ON public.wire_picks TO service_role;
ALTER TABLE public.wire_picks ENABLE ROW LEVEL SECURITY;
CREATE INDEX wire_picks_at_idx ON public.wire_picks (at DESC);
CREATE TRIGGER wire_picks_insert_only BEFORE UPDATE OR DELETE ON public.wire_picks FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.wire_pick_drops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  pick_id bigint NOT NULL REFERENCES public.wire_picks(id),
  actor text NOT NULL CHECK (actor IN ('news', 'standards', 'editor in chief', 'owner')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300)
);
GRANT ALL ON public.wire_pick_drops TO service_role;
ALTER TABLE public.wire_pick_drops ENABLE ROW LEVEL SECURITY;
CREATE INDEX wire_pick_drops_pick_idx ON public.wire_pick_drops (pick_id);
CREATE TRIGGER wire_pick_drops_insert_only BEFORE UPDATE OR DELETE ON public.wire_pick_drops FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.picture_choices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  story_id text NOT NULL REFERENCES public.stories(id),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  kind text NOT NULL CHECK (kind IN ('rule', 'crop', 'pair', 'none')),
  assets text[] NOT NULL DEFAULT '{}' CHECK (cardinality(assets) <= 4),
  verdict text NOT NULL CHECK (verdict IN ('keep', 'alternate', 'none', 'door', 'fallback')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 600),
  per_picture jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (pg_column_size(per_picture) <= 16384),
  call_id bigint REFERENCES public.desk_calls(id)
);
GRANT ALL ON public.picture_choices TO service_role;
ALTER TABLE public.picture_choices ENABLE ROW LEVEL SECURITY;
CREATE INDEX picture_choices_story_idx ON public.picture_choices (story_id, id DESC);
CREATE INDEX picture_choices_at_idx ON public.picture_choices (at DESC);
CREATE TRIGGER picture_choices_insert_only BEFORE UPDATE OR DELETE ON public.picture_choices FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.chart_choices (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  study text NOT NULL CHECK (char_length(study) BETWEEN 1 AND 120),
  figure text NOT NULL CHECK (char_length(figure) BETWEEN 1 AND 120),
  shape text NOT NULL CHECK (char_length(shape) BETWEEN 1 AND 60),
  form text NOT NULL CHECK (char_length(form) BETWEEN 1 AND 60),
  basis text NOT NULL CHECK (basis IN ('only form', 'desk', 'rule')),
  reason text CHECK (char_length(reason) <= 400),
  call_id bigint REFERENCES public.desk_calls(id)
);
GRANT ALL ON public.chart_choices TO service_role;
ALTER TABLE public.chart_choices ENABLE ROW LEVEL SECURITY;
CREATE INDEX chart_choices_study_idx ON public.chart_choices (study, figure, id DESC);
CREATE TRIGGER chart_choices_insert_only BEFORE UPDATE OR DELETE ON public.chart_choices FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.data_findings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  op text NOT NULL CHECK (op IN ('open', 'close')),
  finding_id bigint REFERENCES public.data_findings(id),
  kind text CHECK (kind IN ('contradiction', 'detector', 'impossible', 'coverage', 'wrong website')),
  fkey text CHECK (char_length(fkey) <= 300),
  subject text CHECK (char_length(subject) <= 300),
  measure text CHECK (char_length(measure) <= 120),
  expected text CHECK (char_length(expected) <= 600),
  found text CHECK (char_length(found) <= 600),
  receipt jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(receipt) <= 8192),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  reason text CHECK (char_length(reason) <= 600),
  CONSTRAINT data_findings_shape CHECK ((op = 'open' AND kind IS NOT NULL AND fkey IS NOT NULL AND subject IS NOT NULL AND finding_id IS NULL) OR (op = 'close' AND finding_id IS NOT NULL AND reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.data_findings TO service_role;
ALTER TABLE public.data_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX data_findings_fkey_idx ON public.data_findings (fkey);
CREATE INDEX data_findings_finding_idx ON public.data_findings (finding_id);
CREATE INDEX data_findings_at_idx ON public.data_findings (at DESC);
CREATE TRIGGER data_findings_insert_only BEFORE UPDATE OR DELETE ON public.data_findings FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.forecast_backtests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  run_id bigint NOT NULL REFERENCES public.forecast_runs(id),
  scored_run_id bigint NOT NULL UNIQUE REFERENCES public.forecast_runs(id),
  days numeric NOT NULL CHECK (days > 0),
  calls integer NOT NULL CHECK (calls >= 0),
  right_calls integer NOT NULL CHECK (right_calls >= 0 AND right_calls <= calls),
  mean_miss numeric CHECK (mean_miss >= 0),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(detail) <= 32768)
);
GRANT ALL ON public.forecast_backtests TO service_role;
ALTER TABLE public.forecast_backtests ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER forecast_backtests_insert_only BEFORE UPDATE OR DELETE ON public.forecast_backtests FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.share_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  checked integer NOT NULL CHECK (checked >= 0),
  rebuilt integer NOT NULL DEFAULT 0 CHECK (rebuilt >= 0),
  failures jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (pg_column_size(failures) <= 32768)
);
GRANT ALL ON public.share_checks TO service_role;
ALTER TABLE public.share_checks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER share_checks_insert_only BEFORE UPDATE OR DELETE ON public.share_checks FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- Public facades (read-only, owner rights): the wire picks readers see, and each story's newest picture choice.
CREATE OR REPLACE FUNCTION public.wire_picks_public(p_since timestamptz) RETURNS TABLE (pick_id bigint, at timestamptz, item_id bigint, subject text, line text, domain text, title text, url text, source text, published_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.at, p.item_id, p.subject, p.line, p.domain, w.title, w.url, w.source, w.published_at
  FROM public.wire_picks p JOIN public.wire_items w ON w.id = p.item_id
  WHERE p.at >= greatest(p_since, now() - interval '8 days') AND NOT EXISTS (SELECT 1 FROM public.wire_pick_drops d WHERE d.pick_id = p.id)
  ORDER BY p.at DESC LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.wire_picks_public(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wire_picks_public(timestamptz) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.story_picture_choices(p_ids text[]) RETURNS TABLE (story_id text, at timestamptz, actor text, kind text, assets text[], verdict text, reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (c.story_id) c.story_id, c.at, c.actor, c.kind, c.assets, c.verdict, c.reason
  FROM public.picture_choices c WHERE c.story_id = ANY (p_ids[1:200]) ORDER BY c.story_id, c.id DESC;
$$;
REVOKE ALL ON FUNCTION public.story_picture_choices(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.story_picture_choices(text[]) TO anon, authenticated, service_role;

-- Health: each desk's calls today (UTC) by purpose, fixtures not counted.
CREATE OR REPLACE FUNCTION public.newsroom_desk_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc' AS start)
  SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
    SELECT c.desk || ':' || c.purpose AS k, count(*)::integer AS n FROM public.desk_calls c, d WHERE c.at >= d.start AND c.purpose <> 'fixture' GROUP BY 1
  ) x;
$$;
REVOKE ALL ON FUNCTION public.newsroom_desk_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsroom_desk_facts() TO anon, authenticated, service_role;