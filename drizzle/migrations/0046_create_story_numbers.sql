CREATE TABLE public.story_numbers (
  story_id text PRIMARY KEY REFERENCES public.stories(id),
  number integer NOT NULL UNIQUE CHECK (number > 0),
  assigned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.story_numbers TO anon, authenticated;
GRANT SELECT, INSERT ON public.story_numbers TO service_role;
ALTER TABLE public.story_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story numbers are public to read" ON public.story_numbers FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER story_numbers_append_only BEFORE UPDATE OR DELETE ON public.story_numbers FOR EACH ROW EXECUTE FUNCTION public.stories_append_only();
CREATE TRIGGER story_numbers_no_truncate BEFORE TRUNCATE ON public.story_numbers FOR EACH STATEMENT EXECUTE FUNCTION public.stories_append_only();