CREATE TABLE public.digest_texts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week text NOT NULL CHECK (week ~ '^\d{4}-W\d{2}$'),
  facts_hash text NOT NULL CHECK (char_length(facts_hash) BETWEEN 4 AND 64),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 3 AND 200),
  deck text NOT NULL CHECK (char_length(deck) BETWEEN 1 AND 600),
  argument jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(argument) = 'array'),
  changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
  chart_caption text CHECK (chart_caption IS NULL OR char_length(chart_caption) BETWEEN 1 AND 400),
  use_text text CHECK (use_text IS NULL OR char_length(use_text) BETWEEN 1 AND 600),
  model text NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  failures text[] NOT NULL DEFAULT '{}',
  log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(log) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((passed AND checked_at IS NOT NULL) OR (NOT passed AND checked_at IS NULL))
);
COMMENT ON TABLE public.digest_texts IS 'E5 · the digest writer''s text for one weekly issue, one row per attempt (headline, deck, argument, change sentences, chart caption, use). Insert-only. passed/checked_at = it passed the code check (else the issue uses the fallback). facts_hash = the issue facts sheet it was written from. attempts/log = model calls made (digest calls are capped separately from story and study calls).';
CREATE INDEX digest_texts_week_idx ON public.digest_texts (week, created_at DESC);
CREATE INDEX digest_texts_created_idx ON public.digest_texts (created_at);
GRANT SELECT ON public.digest_texts TO anon, authenticated;
GRANT ALL ON public.digest_texts TO service_role;
ALTER TABLE public.digest_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Passed digest texts are public to read" ON public.digest_texts FOR SELECT TO anon, authenticated USING (passed);

CREATE OR REPLACE FUNCTION public.digest_texts_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'digest_texts is insert-only';
END; $$;
CREATE TRIGGER digest_texts_no_change BEFORE UPDATE OR DELETE ON public.digest_texts FOR EACH ROW EXECUTE FUNCTION public.digest_texts_insert_only();
CREATE TRIGGER digest_texts_no_truncate BEFORE TRUNCATE ON public.digest_texts FOR EACH STATEMENT EXECUTE FUNCTION public.digest_texts_insert_only();