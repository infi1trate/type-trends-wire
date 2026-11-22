-- N2 · the first three desks: their model calls, story reviews, notes and the owner's proposal statuses (all append-only).
CREATE TABLE public.desk_calls (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  desk text NOT NULL CHECK (desk IN ('standards', 'editor in chief')),
  purpose text NOT NULL CHECK (purpose IN ('review', 'placement', 'fixture')),
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 80),
  usage_id bigint,
  ok boolean NOT NULL,
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  prompt_version text CHECK (char_length(prompt_version) <= 40),
  story_ids text[] NOT NULL DEFAULT '{}' CHECK (cardinality(story_ids) <= 60),
  answer jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(answer) <= 32768),
  error text CHECK (char_length(error) <= 200)
);
GRANT ALL ON public.desk_calls TO service_role;
ALTER TABLE public.desk_calls ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_calls_desk_at_idx ON public.desk_calls (desk, at DESC);
CREATE INDEX desk_calls_at_idx ON public.desk_calls (at DESC);
CREATE TRIGGER desk_calls_insert_only BEFORE UPDATE OR DELETE ON public.desk_calls FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.story_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  story_id text NOT NULL REFERENCES public.stories(id),
  desk text NOT NULL CHECK (desk IN ('standards', 'editor in chief')),
  verdict text NOT NULL CHECK (verdict IN ('pass', 'hold', 'run', 'lead')),
  reason text CHECK (char_length(reason) <= 600),
  facts_hash text NOT NULL CHECK (char_length(facts_hash) BETWEEN 1 AND 40),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (pg_column_size(checklist) <= 16384),
  problems jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (pg_column_size(problems) <= 16384),
  second_reader text CHECK (second_reader IN ('ran', 'cap used', 'call failed', 'time ran out', 'not run')),
  placement integer CHECK (placement BETWEEN 1 AND 100),
  basis text NOT NULL DEFAULT 'desk' CHECK (basis IN ('desk', 'engine order')),
  call_id bigint REFERENCES public.desk_calls(id),
  prompt_version text CHECK (char_length(prompt_version) <= 40),
  CONSTRAINT story_reviews_reason CHECK (verdict <> 'hold' OR (reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.story_reviews TO service_role;
ALTER TABLE public.story_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX story_reviews_story_idx ON public.story_reviews (story_id, id DESC);
CREATE INDEX story_reviews_at_idx ON public.story_reviews (at DESC);
CREATE TRIGGER story_reviews_insert_only BEFORE UPDATE OR DELETE ON public.story_reviews FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.desk_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  subject_kind text NOT NULL CHECK (subject_kind IN ('story', 'study', 'brand', 'signal')),
  subject_id text NOT NULL CHECK (char_length(subject_id) BETWEEN 1 AND 200),
  text text NOT NULL CHECK (char_length(btrim(text)) BETWEEN 3 AND 1000)
);
GRANT ALL ON public.desk_notes TO service_role;
ALTER TABLE public.desk_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_notes_at_idx ON public.desk_notes (at DESC);
CREATE INDEX desk_notes_subject_idx ON public.desk_notes (subject_kind, subject_id, at DESC);
CREATE TRIGGER desk_notes_insert_only BEFORE UPDATE OR DELETE ON public.desk_notes FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.proposal_statuses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  log_id bigint NOT NULL REFERENCES public.desk_log(id),
  status text NOT NULL CHECK (status IN ('open', 'accepted', 'declined')),
  actor text NOT NULL CHECK (actor = 'owner'),
  reason text CHECK (char_length(reason) <= 300)
);
GRANT ALL ON public.proposal_statuses TO service_role;
ALTER TABLE public.proposal_statuses ENABLE ROW LEVEL SECURITY;
CREATE INDEX proposal_statuses_log_idx ON public.proposal_statuses (log_id, id DESC);
CREATE TRIGGER proposal_statuses_insert_only BEFORE UPDATE OR DELETE ON public.proposal_statuses FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- Public counting facts for health: today's (UTC) writer-model calls split by who made them, each desk's calls against its cap, and
-- how many stories passed standards today without the second reader. Counts only; the writer model id mirrors AI_MODELS.writer.
CREATE OR REPLACE FUNCTION public.newsroom_call_facts() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (SELECT date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc' AS start),
  w AS (SELECT count(*)::integer AS n FROM public.ai_usage u, d WHERE u.kind = 'story_why' AND u.model = 'openai/gpt-6.2-astra' AND u.snapshot_id IS NULL AND u.state <> 'rejected' AND u.created_at >= d.start),
  st AS (SELECT coalesce(sum((SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.log) = 'array' THEN t.log ELSE '[]'::jsonb END) x WHERE x->>'model' = 'openai/gpt-6.2-astra')), 0)::integer AS n FROM public.study_texts t, d WHERE t.created_at >= d.start),
  dg AS (SELECT coalesce(sum((SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(t.log) = 'array' THEN t.log ELSE '[]'::jsonb END) x WHERE x->>'model' = 'openai/gpt-6.2-astra')), 0)::integer AS n FROM public.digest_texts t, d WHERE t.created_at >= d.start),
  dc AS (SELECT count(*) FILTER (WHERE c.desk = 'standards' AND c.purpose <> 'fixture')::integer AS s, count(*) FILTER (WHERE c.desk = 'editor in chief' AND c.purpose <> 'fixture')::integer AS e,
    count(*) FILTER (WHERE c.model = 'openai/gpt-6.2-astra')::integer AS wm FROM public.desk_calls c, d WHERE c.at >= d.start),
  rv AS (SELECT count(*)::integer AS n FROM public.story_reviews r, d WHERE r.desk = 'standards' AND r.verdict = 'pass' AND r.second_reader IS DISTINCT FROM 'ran' AND r.at >= d.start)
  SELECT jsonb_build_object('day_start', d.start, 'writer_model_calls', w.n, 'study', st.n, 'digest', dg.n, 'desks_writer_model', dc.wm,
    'story', greatest(0, w.n - st.n - dg.n - dc.wm), 'standards', dc.s, 'chief', dc.e, 'without_second_reader', rv.n)
  FROM d, w, st, dg, dc, rv;
$$;
REVOKE ALL ON FUNCTION public.newsroom_call_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.newsroom_call_facts() TO anon, authenticated, service_role;