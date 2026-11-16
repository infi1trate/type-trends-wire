CREATE TABLE public.stories (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 3 AND 200),
  type text NOT NULL CHECK (type IN ('move','rebrand','shift','breakout','first_seen','crossover','counter_move','white_space','roundup','launch','news')),
  status text NOT NULL CHECK (status IN ('published','held')),
  reason text NOT NULL,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  components jsonb NOT NULL,
  why_ran text NOT NULL,
  kicker text NOT NULL,
  headline text NOT NULL,
  deck text,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  why_line text CHECK (why_line IS NULL OR length(why_line) <= 220),
  why_model text,
  why_at timestamptz,
  sector text,
  signal_keys text[] NOT NULL DEFAULT '{}',
  domains text[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ids text[] NOT NULL DEFAULT '{}',
  basis text CHECK (basis IS NULL OR basis IN ('measured','ai')),
  happened_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stories_happened_idx ON public.stories (happened_at DESC);
CREATE INDEX stories_signal_keys_idx ON public.stories USING gin (signal_keys);
CREATE INDEX stories_domains_idx ON public.stories USING gin (domains);
GRANT SELECT ON public.stories TO anon, authenticated;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stories are public to read" ON public.stories FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.story_edits (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id text NOT NULL REFERENCES public.stories(id),
  action text NOT NULL CHECK (action IN ('pin','kill','correct','restore')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text CHECK (note IS NULL OR length(note) <= 500),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX story_edits_story_idx ON public.story_edits (story_id, at);
GRANT SELECT ON public.story_edits TO anon, authenticated;
GRANT ALL ON public.story_edits TO service_role;
ALTER TABLE public.story_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story edits are public to read" ON public.story_edits FOR SELECT TO anon, authenticated USING (true);

CREATE FUNCTION public.stories_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER stories_append_only BEFORE UPDATE OR DELETE ON public.stories FOR EACH ROW EXECUTE FUNCTION public.stories_append_only();
CREATE TRIGGER stories_no_truncate BEFORE TRUNCATE ON public.stories FOR EACH STATEMENT EXECUTE FUNCTION public.stories_append_only();
CREATE TRIGGER story_edits_append_only BEFORE UPDATE OR DELETE ON public.story_edits FOR EACH ROW EXECUTE FUNCTION public.stories_append_only();
CREATE TRIGGER story_edits_no_truncate BEFORE TRUNCATE ON public.story_edits FOR EACH STATEMENT EXECUTE FUNCTION public.stories_append_only();