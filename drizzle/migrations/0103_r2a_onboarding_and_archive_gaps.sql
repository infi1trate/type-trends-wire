ALTER TABLE public.library_sites ADD COLUMN onboarding boolean NOT NULL DEFAULT false;
CREATE INDEX library_sites_onboarding_idx ON public.library_sites (onboarding) WHERE onboarding;
CREATE TABLE public.library_archive_gaps (
  domain text NOT NULL,
  quarter text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('no_capture','unreadable')),
  run_id text,
  noted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, quarter)
);
GRANT ALL ON public.library_archive_gaps TO service_role;
ALTER TABLE public.library_archive_gaps ENABLE ROW LEVEL SECURITY;