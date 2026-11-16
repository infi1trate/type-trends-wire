CREATE TABLE public.story_lines (
  story_id text PRIMARY KEY REFERENCES public.stories(id),
  why_line text NOT NULL CHECK (length(why_line) BETWEEN 1 AND 220),
  why_model text NOT NULL,
  why_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.story_lines TO anon, authenticated;
GRANT ALL ON public.story_lines TO service_role;
ALTER TABLE public.story_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Story lines are public to read" ON public.story_lines FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER story_lines_append_only BEFORE UPDATE OR DELETE ON public.story_lines FOR EACH ROW EXECUTE FUNCTION public.stories_append_only();
CREATE TRIGGER story_lines_no_truncate BEFORE TRUNCATE ON public.story_lines FOR EACH STATEMENT EXECUTE FUNCTION public.stories_append_only();