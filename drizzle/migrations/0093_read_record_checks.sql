CREATE TABLE public.read_record_checks (
  key text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  source text
);
REVOKE ALL ON public.read_record_checks FROM anon, authenticated;
GRANT ALL ON public.read_record_checks TO service_role;
ALTER TABLE public.read_record_checks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.read_record_checks IS 'D1c: when the records sweep last found a stored page (or a whole per-brand set, keyed by kind) unchanged, so unchanged pages are not re-timed every pass. Service role only.';