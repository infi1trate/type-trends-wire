CREATE TABLE public.story_texts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id text NOT NULL REFERENCES public.stories(id),
  version integer NOT NULL CHECK (version >= 1),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 3 AND 200),
  deck text NOT NULL CHECK (char_length(deck) BETWEEN 1 AND 600),
  body text[] NOT NULL DEFAULT '{}' CHECK (cardinality(body) <= 6),
  how_we_know text NOT NULL CHECK (char_length(how_we_know) BETWEEN 1 AND 300),
  model text NOT NULL,
  cost numeric NOT NULL DEFAULT 0 CHECK (cost >= 0),
  checked boolean NOT NULL,
  attempts smallint NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 0 AND 10),
  failures text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, version)
);
COMMENT ON TABLE public.story_texts IS 'The writer''s Read-side text for a story, one row per story and version (headline, deck, body, how we know). Insert-only. checked = passed the code check; model = template when both models failed. The template headline and deck stay on stories.';
CREATE INDEX story_texts_story_idx ON public.story_texts (story_id, version DESC);
CREATE INDEX story_texts_created_idx ON public.story_texts (created_at);
GRANT SELECT ON public.story_texts TO anon, authenticated;
GRANT ALL ON public.story_texts TO service_role;
ALTER TABLE public.story_texts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checked story texts are public to read" ON public.story_texts FOR SELECT TO anon, authenticated USING (checked);

CREATE OR REPLACE FUNCTION public.story_texts_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'story_texts is insert-only';
END; $$;
CREATE TRIGGER story_texts_no_change BEFORE UPDATE OR DELETE ON public.story_texts FOR EACH ROW EXECUTE FUNCTION public.story_texts_insert_only();
CREATE TRIGGER story_texts_no_truncate BEFORE TRUNCATE ON public.story_texts FOR EACH STATEMENT EXECUTE FUNCTION public.story_texts_insert_only();