CREATE TABLE public.study_texts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  facts_hash text NOT NULL CHECK (char_length(facts_hash) BETWEEN 4 AND 64),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 3 AND 200),
  deck text NOT NULL CHECK (char_length(deck) BETWEEN 1 AND 600),
  opening text NOT NULL CHECK (char_length(opening) BETWEEN 1 AND 2400),
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(scenes) = 'array'),
  use_text text CHECK (use_text IS NULL OR char_length(use_text) BETWEEN 1 AND 1200),
  model text NOT NULL,
  checked_at timestamptz,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  failures text[] NOT NULL DEFAULT '{}',
  log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(log) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.study_texts IS 'E4 · the study writer''s text, one row per attempt (headline, deck, opening, scenes, use). Insert-only. checked_at = when it passed the code check (null: it did not, the page uses the template). facts_hash = the facts sheet it was written from. attempts/log = model calls made (study calls are capped separately from story calls).';
CREATE INDEX study_texts_slug_idx ON public.study_texts (slug, created_at DESC);
CREATE INDEX study_texts_created_idx ON public.study_texts (created_at);
GRANT SELECT ON public.study_texts TO anon, authenticated;
GRANT ALL ON public.study_texts TO service_role;
ALTER TABLE public.study_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checked study texts are public to read" ON public.study_texts FOR SELECT TO anon, authenticated USING (checked_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.study_texts_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'study_texts is insert-only';
END; $$;
CREATE TRIGGER study_texts_no_change BEFORE UPDATE OR DELETE ON public.study_texts FOR EACH ROW EXECUTE FUNCTION public.study_texts_insert_only();
CREATE TRIGGER study_texts_no_truncate BEFORE TRUNCATE ON public.study_texts FOR EACH STATEMENT EXECUTE FUNCTION public.study_texts_insert_only();