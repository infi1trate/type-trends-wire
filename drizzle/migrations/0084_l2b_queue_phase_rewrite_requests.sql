-- L2b · approved by the owner: the build queue takes kind 'phase' with an optional phase name (the wider kind list and the new
-- nullable column are additive; no stored row changes). And a new append-only, service-role-only record of rewrite requests.
ALTER TABLE public.build_queue DROP CONSTRAINT build_queue_kind_check;
ALTER TABLE public.build_queue ADD CONSTRAINT build_queue_kind_check CHECK (kind IN ('bug', 'label', 'design move', 'layout', 'feature', 'phase'));
ALTER TABLE public.build_queue ADD COLUMN phase text CHECK (phase IS NULL OR char_length(btrim(phase)) BETWEEN 2 AND 12);
ALTER TABLE public.build_queue ADD CONSTRAINT build_queue_phase_kind CHECK ((kind = 'phase') = (phase IS NOT NULL));

-- A desk asks the story writer to rewrite a published story at its next allowance (first in its queue). The request is honoured by
-- the next story_texts version the writer makes after it; nothing here changes a story.
CREATE TABLE public.rewrite_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  story_id text NOT NULL CHECK (char_length(story_id) BETWEEN 3 AND 200),
  actor text NOT NULL CHECK (actor IN ('standards', 'copy desk', 'editor in chief', 'owner')),
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300)
);
GRANT ALL ON public.rewrite_requests TO service_role;
ALTER TABLE public.rewrite_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX rewrite_requests_story_idx ON public.rewrite_requests (story_id, id DESC);
CREATE TRIGGER rewrite_requests_insert_only BEFORE UPDATE OR DELETE ON public.rewrite_requests FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();