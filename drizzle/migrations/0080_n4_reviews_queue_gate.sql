-- N4 · page reviews, the build queue and the gate: append-only records (service role only), a queue item on build spend, and wider checks.
ALTER TABLE public.desk_calls DROP CONSTRAINT desk_calls_desk_check;
ALTER TABLE public.desk_calls ADD CONSTRAINT desk_calls_desk_check CHECK (desk IN ('standards', 'editor in chief', 'news', 'graphics', 'data', 'design review'));
ALTER TABLE public.desk_log DROP CONSTRAINT desk_log_subject_kind_check;
ALTER TABLE public.desk_log ADD CONSTRAINT desk_log_subject_kind_check CHECK (subject_kind IN ('story', 'study', 'pitch', 'edition', 'setting', 'switch', 'spend', 'week', 'none', 'wire', 'finding', 'review', 'queue'));

CREATE TABLE public.page_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  run text NOT NULL CHECK (char_length(btrim(run)) BETWEEN 1 AND 40),
  kind text NOT NULL CHECK (kind IN ('weekly', 'before', 'after', 'test')),
  page text NOT NULL CHECK (page IN ('front', 'story', 'brand', 'study', 'terminal', 'digest', 'studies', 'brands', 'signals')),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 300),
  width integer NOT NULL CHECK (width IN (1440, 768, 390)),
  against text CHECK (char_length(against) <= 40),
  measures jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(measures) = 'object' AND pg_column_size(measures) <= 4096),
  picture_path text CHECK (char_length(picture_path) <= 300),
  picture_bytes integer CHECK (picture_bytes > 0 AND picture_bytes <= 153600),
  picture_width integer CHECK (picture_width BETWEEN 1 AND 1280),
  picture_height integer CHECK (picture_height BETWEEN 1 AND 1600),
  actor text NOT NULL CHECK (actor IN ('design review', 'engineering'))
);
GRANT ALL ON public.page_reviews TO service_role;
ALTER TABLE public.page_reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX page_reviews_run_idx ON public.page_reviews (run, id DESC);
CREATE INDEX page_reviews_at_idx ON public.page_reviews (at DESC);
CREATE TRIGGER page_reviews_insert_only BEFORE UPDATE OR DELETE ON public.page_reviews FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.build_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 140),
  why text NOT NULL CHECK (char_length(btrim(why)) BETWEEN 3 AND 600),
  desk text NOT NULL CHECK (char_length(desk) BETWEEN 1 AND 40),
  kind text NOT NULL CHECK (kind IN ('bug', 'label', 'design move', 'layout', 'feature')),
  expects text NOT NULL CHECK (expects IN ('no visible change', 'small', 'layout')),
  source_kind text NOT NULL DEFAULT 'none' CHECK (source_kind IN ('proposal', 'finding', 'breach', 'none')),
  source_ref text CHECK (char_length(source_ref) <= 200),
  proposal_log_id bigint REFERENCES public.desk_log(id),
  ikey text CHECK (char_length(ikey) BETWEEN 3 AND 200),
  move jsonb CHECK (move IS NULL OR (jsonb_typeof(move) = 'object' AND pg_column_size(move) <= 2048)),
  test boolean NOT NULL DEFAULT false,
  CONSTRAINT build_queue_source CHECK ((source_kind = 'proposal') = (proposal_log_id IS NOT NULL))
);
GRANT ALL ON public.build_queue TO service_role;
ALTER TABLE public.build_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX build_queue_key_idx ON public.build_queue (ikey);
CREATE INDEX build_queue_at_idx ON public.build_queue (at DESC);
CREATE TRIGGER build_queue_insert_only BEFORE UPDATE OR DELETE ON public.build_queue FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.build_queue_moves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  item_id bigint NOT NULL REFERENCES public.build_queue(id),
  status text NOT NULL CHECK (status IN ('queued', 'briefed', 'built', 'gate passed', 'gate failed', 'live', 'declined')),
  actor text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 40),
  reason text CHECK (char_length(reason) <= 600),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(detail) <= 4096),
  CONSTRAINT build_queue_moves_reason CHECK (status <> 'declined' OR (reason IS NOT NULL AND char_length(btrim(reason)) >= 3))
);
GRANT ALL ON public.build_queue_moves TO service_role;
ALTER TABLE public.build_queue_moves ENABLE ROW LEVEL SECURITY;
CREATE INDEX build_queue_moves_item_idx ON public.build_queue_moves (item_id, id DESC);
CREATE TRIGGER build_queue_moves_insert_only BEFORE UPDATE OR DELETE ON public.build_queue_moves FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.gate_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  item_id bigint NOT NULL REFERENCES public.build_queue(id),
  commit_sha text NOT NULL CHECK (commit_sha ~ '^[0-9a-f]{7,40}$'),
  tests jsonb NOT NULL CHECK (jsonb_typeof(tests) = 'object' AND pg_column_size(tests) <= 512),
  before_run text NOT NULL CHECK (char_length(before_run) BETWEEN 1 AND 40),
  after_run text NOT NULL CHECK (char_length(after_run) BETWEEN 1 AND 40),
  pass boolean NOT NULL,
  checks jsonb NOT NULL CHECK (jsonb_typeof(checks) = 'array' AND pg_column_size(checks) <= 32768),
  actor text NOT NULL CHECK (actor = 'engineering')
);
GRANT ALL ON public.gate_results TO service_role;
ALTER TABLE public.gate_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX gate_results_item_idx ON public.gate_results (item_id, id DESC);
CREATE TRIGGER gate_results_insert_only BEFORE UPDATE OR DELETE ON public.gate_results FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

ALTER TABLE public.spend_entries ADD COLUMN queue_item bigint REFERENCES public.build_queue(id);
CREATE INDEX spend_entries_queue_item_idx ON public.spend_entries (queue_item) WHERE queue_item IS NOT NULL;