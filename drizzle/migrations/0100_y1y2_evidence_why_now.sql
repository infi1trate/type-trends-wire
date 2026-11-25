CREATE TABLE public.evidence_dossiers (
  signal text PRIMARY KEY,
  name text NOT NULL,
  rise_start text,
  rise_end text,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  built_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.evidence_dossiers TO service_role;
ALTER TABLE public.evidence_dossiers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.why_now_blocks (
  id bigserial PRIMARY KEY,
  subject_kind text NOT NULL,
  subject_id text NOT NULL,
  status text NOT NULL,
  block jsonb NOT NULL DEFAULT '{}'::jsonb,
  failures text[] NOT NULL DEFAULT '{}',
  dossier_at timestamptz,
  model text,
  written_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX why_now_blocks_subject_idx ON public.why_now_blocks (subject_kind, subject_id, written_at DESC);
GRANT SELECT ON public.why_now_blocks TO anon, authenticated;
GRANT ALL ON public.why_now_blocks TO service_role;
GRANT USAGE ON SEQUENCE public.why_now_blocks_id_seq TO service_role;
ALTER TABLE public.why_now_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read of passed blocks" ON public.why_now_blocks FOR SELECT TO anon, authenticated USING (status = 'passed');