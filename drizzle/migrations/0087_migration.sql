-- D1 Part 2 · what a crawler post leaves out of date for the one follow-up worker (service role only; one row per topic).
CREATE TABLE public.work_marks (
  topic text PRIMARY KEY CHECK (char_length(topic) BETWEEN 1 AND 200),
  marked_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);
GRANT ALL ON public.work_marks TO service_role;
ALTER TABLE public.work_marks ENABLE ROW LEVEL SECURITY;
CREATE INDEX work_marks_open ON public.work_marks (marked_at) WHERE done_at IS NULL;