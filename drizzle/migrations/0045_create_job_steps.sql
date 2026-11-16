CREATE TABLE public.job_steps (
  job text NOT NULL,
  run_key text NOT NULL,
  step text NOT NULL,
  position smallint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error', 'skipped')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_until timestamptz,
  detail text CHECK (detail IS NULL OR char_length(detail) <= 300),
  PRIMARY KEY (job, run_key, step)
);
CREATE INDEX job_steps_open_idx ON public.job_steps (status, queued_at);
COMMENT ON TABLE public.job_steps IS 'Follow-up steps of scheduled jobs (e.g. the weekly forecast''s brief, chart, ledger and story build), run one bounded step per scheduled call. Public read: job names, times and short status codes only.';
GRANT SELECT ON public.job_steps TO anon, authenticated;
GRANT ALL ON public.job_steps TO service_role;
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Job steps are public to read" ON public.job_steps FOR SELECT TO anon, authenticated USING (true);