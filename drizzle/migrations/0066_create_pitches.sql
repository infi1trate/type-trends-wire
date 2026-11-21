CREATE TABLE public.pitches (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('change', 'signal', 'brand', 'census', 'receipt')),
  ref text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 200),
  facts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(facts) = 'array'),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 140),
  pitched_by text NOT NULL CHECK (char_length(pitched_by) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pitches IS 'U4: rows an editor pitched to the desk (insert-only; staff read through the editor endpoint). A pitch never publishes; the engine answers it in pitch_verdicts.';

CREATE TABLE public.pitch_verdicts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pitch_id bigint NOT NULL REFERENCES public.pitches(id),
  status text NOT NULL CHECK (status IN ('story', 'would_run', 'held', 'refused', 'ran')),
  verdict jsonb NOT NULL CHECK (jsonb_typeof(verdict) = 'object'),
  story_id text,
  story_number integer,
  source text NOT NULL CHECK (source IN ('desk', 'build')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pitch_verdicts IS 'U4: the story engine''s answer to a pitch, appended each time it changes (insert-only; latest row is the pitch''s status).';
CREATE INDEX pitch_verdicts_pitch_idx ON public.pitch_verdicts (pitch_id, id DESC);
CREATE INDEX pitches_created_idx ON public.pitches (created_at DESC);

GRANT ALL ON public.pitches TO service_role;
GRANT ALL ON public.pitch_verdicts TO service_role;
ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_verdicts ENABLE ROW LEVEL SECURITY;
-- No policies and no anon/authenticated grants: visitors can neither read nor write; only the editor endpoint (after the key) can.

CREATE FUNCTION public.pitches_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only', TG_TABLE_NAME;
END; $$;
CREATE TRIGGER pitches_no_update BEFORE UPDATE OR DELETE ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.pitches_insert_only();
CREATE TRIGGER pitch_verdicts_no_update BEFORE UPDATE OR DELETE ON public.pitch_verdicts FOR EACH ROW EXECUTE FUNCTION public.pitches_insert_only();
REVOKE ALL ON FUNCTION public.pitches_insert_only() FROM PUBLIC;