-- N4c · job runs: every scheduled job writes a start row before work and one finish row after. Review passes also claim a unique
-- slot with their start row, so never two in one slot. Append-only, service role only (the N2 pattern).
CREATE TABLE public.job_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  job text NOT NULL CHECK (char_length(job) BETWEEN 1 AND 40),
  phase text NOT NULL CHECK (phase IN ('start', 'finish')),
  start_id bigint REFERENCES public.job_runs(id),
  slot text CHECK (char_length(slot) BETWEEN 10 AND 40),
  items jsonb CHECK (items IS NULL OR (jsonb_typeof(items) = 'array' AND pg_column_size(items) <= 4096)),
  ok boolean,
  ms integer CHECK (ms >= 0),
  note text CHECK (char_length(note) <= 200),
  detail jsonb CHECK (detail IS NULL OR pg_column_size(detail) <= 16384),
  CHECK ((phase = 'start' AND start_id IS NULL AND ok IS NULL AND ms IS NULL) OR (phase = 'finish' AND start_id IS NOT NULL AND ok IS NOT NULL AND ms IS NOT NULL))
);
GRANT ALL ON public.job_runs TO service_role;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX job_runs_finish_once ON public.job_runs (start_id) WHERE phase = 'finish';
CREATE UNIQUE INDEX job_runs_one_slot ON public.job_runs (job, slot) WHERE phase = 'start' AND slot IS NOT NULL;
CREATE INDEX job_runs_at_idx ON public.job_runs (at, job);
CREATE TRIGGER job_runs_insert_only BEFORE UPDATE OR DELETE ON public.job_runs FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- N4c · the facts sheet the story build had for a story waiting for review (written only when it changed), read by the review pass.
CREATE TABLE public.review_sheets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  story_id text NOT NULL REFERENCES public.stories(id),
  hash text NOT NULL CHECK (char_length(hash) BETWEEN 1 AND 40),
  sheet jsonb NOT NULL CHECK (pg_column_size(sheet) <= 65536)
);
GRANT ALL ON public.review_sheets TO service_role;
ALTER TABLE public.review_sheets ENABLE ROW LEVEL SECURITY;
CREATE INDEX review_sheets_story_idx ON public.review_sheets (story_id, id DESC);
CREATE TRIGGER review_sheets_insert_only BEFORE UPDATE OR DELETE ON public.review_sheets FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

-- N4c · the checklist code's fingerprint each standards review was made with.
CREATE TABLE public.review_checklists (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  review_id bigint NOT NULL UNIQUE REFERENCES public.story_reviews(id),
  story_id text NOT NULL CHECK (char_length(story_id) BETWEEN 1 AND 300),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) BETWEEN 1 AND 40)
);
GRANT ALL ON public.review_checklists TO service_role;
ALTER TABLE public.review_checklists ENABLE ROW LEVEL SECURITY;
CREATE INDEX review_checklists_story_idx ON public.review_checklists (story_id, id DESC);
CREATE TRIGGER review_checklists_insert_only BEFORE UPDATE OR DELETE ON public.review_checklists FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();