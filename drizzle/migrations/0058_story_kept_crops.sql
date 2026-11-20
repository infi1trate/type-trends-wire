CREATE TABLE public.story_kept_crops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  story_id text NOT NULL REFERENCES public.stories(id),
  crop_id bigint NOT NULL REFERENCES public.site_crops(id) ON DELETE CASCADE,
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 400),
  domain text NOT NULL CHECK (char_length(domain) BETWEEN 3 AND 253),
  role text NOT NULL CHECK (role IN ('before', 'after', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, crop_id)
);
COMMENT ON TABLE public.story_kept_crops IS 'E2c: the stored section crops a published story cites (before, after, or a gathered story''s member heroes). While the story is published, crop history eviction skips these crops; an owner opt-out still deletes every crop of the brand, and these rows go with it (ON DELETE CASCADE). No updates.';
CREATE INDEX story_kept_crops_story_idx ON public.story_kept_crops (story_id);
CREATE INDEX story_kept_crops_crop_idx ON public.story_kept_crops (crop_id);
GRANT SELECT ON public.story_kept_crops TO anon, authenticated;
GRANT ALL ON public.story_kept_crops TO service_role;
ALTER TABLE public.story_kept_crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kept story crops are public to read" ON public.story_kept_crops FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.story_kept_crops_no_update() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'story_kept_crops rows are never updated';
END; $$;
CREATE TRIGGER story_kept_crops_no_update BEFORE UPDATE ON public.story_kept_crops FOR EACH ROW EXECUTE FUNCTION public.story_kept_crops_no_update();