-- N5 · publisher and scout desks, and a note on stored job runs. New append-only tables only (service role only, the N2 pattern);
-- no existing table, constraint, function or policy changes.

-- A note appended to a stored job run (the N4c test rows are marked as tests this way; the runs themselves never change).
CREATE TABLE public.job_run_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  run_id bigint NOT NULL REFERENCES public.job_runs(id),
  test boolean NOT NULL DEFAULT false,
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 3 AND 300)
);
GRANT ALL ON public.job_run_notes TO service_role;
ALTER TABLE public.job_run_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX job_run_notes_run_idx ON public.job_run_notes (run_id);
CREATE TRIGGER job_run_notes_insert_only BEFORE UPDATE OR DELETE ON public.job_run_notes FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- The publisher's and the scout's model calls (desk_calls keeps its own fixed desk list).
CREATE TABLE public.desk_calls_weekly (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  desk text NOT NULL CHECK (desk IN ('publisher', 'scout')),
  purpose text NOT NULL CHECK (purpose IN ('drafts', 'candidates', 'fixture')),
  model text NOT NULL CHECK (char_length(model) BETWEEN 1 AND 80),
  usage_id bigint,
  ok boolean NOT NULL,
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  prompt_version text CHECK (char_length(prompt_version) <= 40),
  week text CHECK (week ~ '^\d{4}-W\d{2}$'),
  answer jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(answer) <= 32768),
  error text CHECK (char_length(error) <= 200)
);
GRANT ALL ON public.desk_calls_weekly TO service_role;
ALTER TABLE public.desk_calls_weekly ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_calls_weekly_desk_at_idx ON public.desk_calls_weekly (desk, at DESC);
CREATE TRIGGER desk_calls_weekly_insert_only BEFORE UPDATE OR DELETE ON public.desk_calls_weekly FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- B1 · the publisher's package check on the newest Digest issue: one row per check run with every item.
CREATE TABLE public.package_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  issue integer CHECK (issue BETWEEN 1 AND 10000),
  pass boolean NOT NULL,
  checks jsonb NOT NULL CHECK (jsonb_typeof(checks) = 'array' AND pg_column_size(checks) <= 16384),
  test boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.package_checks TO service_role;
ALTER TABLE public.package_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX package_checks_week_idx ON public.package_checks (week, id DESC);
CREATE TRIGGER package_checks_insert_only BEFORE UPDATE OR DELETE ON public.package_checks FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- B1 · social drafts (drafts only: nothing here posts) and their owner-set statuses.
CREATE TABLE public.social_drafts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  check_id bigint NOT NULL REFERENCES public.package_checks(id),
  call_id bigint REFERENCES public.desk_calls_weekly(id),
  target text NOT NULL CHECK (target IN ('digest', 'story')),
  story_id text CHECK (char_length(story_id) <= 300),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 3 AND 280),
  link text NOT NULL CHECK (link ~ '^https://slug\.global/' AND char_length(link) <= 200),
  test boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.social_drafts TO service_role;
ALTER TABLE public.social_drafts ENABLE ROW LEVEL SECURITY;
CREATE INDEX social_drafts_week_idx ON public.social_drafts (week, id DESC);
CREATE TRIGGER social_drafts_insert_only BEFORE UPDATE OR DELETE ON public.social_drafts FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.social_draft_statuses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  draft_id bigint NOT NULL REFERENCES public.social_drafts(id),
  status text NOT NULL CHECK (status IN ('approved', 'posted', 'declined')),
  actor text NOT NULL CHECK (actor = 'owner'),
  reason text CHECK (char_length(reason) <= 300)
);
GRANT ALL ON public.social_draft_statuses TO service_role;
ALTER TABLE public.social_draft_statuses ENABLE ROW LEVEL SECURITY;
CREATE INDEX social_draft_statuses_draft_idx ON public.social_draft_statuses (draft_id, id DESC);
CREATE TRIGGER social_draft_statuses_insert_only BEFORE UPDATE OR DELETE ON public.social_draft_statuses FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- B1 · a week's audience numbers from the host's own analytics, entered by the publisher's outside session (counts only).
CREATE TABLE public.audience_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  visitors integer NOT NULL CHECK (visitors >= 0),
  pageviews integer NOT NULL CHECK (pageviews >= 0),
  top jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(top) = 'array' AND jsonb_array_length(top) <= 20 AND pg_column_size(top) <= 8192),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array' AND jsonb_array_length(sources) <= 10 AND pg_column_size(sources) <= 4096),
  actor text NOT NULL CHECK (actor IN ('publisher', 'owner')),
  test boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.audience_weeks TO service_role;
ALTER TABLE public.audience_weeks ENABLE ROW LEVEL SECURITY;
CREATE INDEX audience_weeks_week_idx ON public.audience_weeks (week, id DESC);
CREATE TRIGGER audience_weeks_insert_only BEFORE UPDATE OR DELETE ON public.audience_weeks FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- B2 · terms readings appended to the sources register (the register itself lives in code).
CREATE TABLE public.source_notes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (char_length(source) BETWEEN 1 AND 60),
  status text NOT NULL CHECK (status IN ('read', 'needs permission', 'closed by its terms', 'off')),
  read_on date,
  link text CHECK (link ~ '^https://' AND char_length(link) <= 300),
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 3 AND 200),
  actor text NOT NULL CHECK (actor IN ('scout', 'owner'))
);
GRANT ALL ON public.source_notes TO service_role;
ALTER TABLE public.source_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX source_notes_source_idx ON public.source_notes (source, id DESC);
CREATE TRIGGER source_notes_insert_only BEFORE UPDATE OR DELETE ON public.source_notes FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- B2 · brand candidates the scout proposes, and their statuses (owner accepts or declines; engineering marks an accepted one added).
CREATE TABLE public.brand_candidates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  domain text NOT NULL CHECK (char_length(domain) BETWEEN 3 AND 253),
  sector text NOT NULL CHECK (char_length(sector) BETWEEN 1 AND 40),
  why text NOT NULL CHECK (char_length(btrim(why)) BETWEEN 3 AND 300),
  cites text NOT NULL CHECK (char_length(cites) BETWEEN 1 AND 80),
  call_id bigint REFERENCES public.desk_calls_weekly(id),
  log_id bigint,
  test boolean NOT NULL DEFAULT false
);
GRANT ALL ON public.brand_candidates TO service_role;
ALTER TABLE public.brand_candidates ENABLE ROW LEVEL SECURITY;
CREATE INDEX brand_candidates_week_idx ON public.brand_candidates (week, id DESC);
CREATE INDEX brand_candidates_domain_idx ON public.brand_candidates (domain);
CREATE TRIGGER brand_candidates_insert_only BEFORE UPDATE OR DELETE ON public.brand_candidates FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.brand_candidate_statuses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  candidate_id bigint NOT NULL REFERENCES public.brand_candidates(id),
  status text NOT NULL CHECK (status IN ('accepted', 'declined', 'added')),
  actor text NOT NULL CHECK (actor IN ('owner', 'engineering')),
  reason text CHECK (char_length(reason) <= 300),
  CHECK (actor = 'owner' OR status = 'added')
);
GRANT ALL ON public.brand_candidate_statuses TO service_role;
ALTER TABLE public.brand_candidate_statuses ENABLE ROW LEVEL SECURITY;
CREATE INDEX brand_candidate_statuses_candidate_idx ON public.brand_candidate_statuses (candidate_id, id DESC);
CREATE TRIGGER brand_candidate_statuses_insert_only BEFORE UPDATE OR DELETE ON public.brand_candidate_statuses FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();