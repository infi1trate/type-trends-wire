CREATE TABLE public.living_editions (
  number integer PRIMARY KEY CHECK (number >= 0),
  dated date NOT NULL,
  "values" jsonb NOT NULL CHECK (jsonb_typeof("values") = 'object'),
  comparison jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.living_editions IS 'L1: slug''s own design editions. One row per edition with the value of every living setting (src/lib/living/settings.ts) and the screenshot comparison for the approver. Insert-only.';
CREATE TABLE public.living_moves (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  edition integer NOT NULL REFERENCES public.living_editions(number),
  setting text NOT NULL,
  old_value jsonb NOT NULL,
  new_value jsonb NOT NULL,
  signal text,
  share double precision CHECK (share IS NULL OR (share >= 0 AND share <= 1)),
  count integer CHECK (count IS NULL OR count >= 0),
  base integer CHECK (base IS NULL OR base >= 0),
  rule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition, setting)
);
COMMENT ON TABLE public.living_moves IS 'L1: the moves of an edition: setting, old and new value, the measured signal (share, count, base) and the rule that fired. Insert-only.';
CREATE TABLE public.living_edition_status (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  edition integer NOT NULL REFERENCES public.living_editions(number),
  status text NOT NULL CHECK (status IN ('baseline', 'proposed', 'approved', 'live', 'rolled back')),
  note text CHECK (note IS NULL OR length(note) <= 500),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX living_edition_status_edition_idx ON public.living_edition_status (edition, at);
COMMENT ON TABLE public.living_edition_status IS 'L1: every status an edition has had; the newest row is its status. Approve and roll back append rows (editor key). Insert-only.';

CREATE OR REPLACE FUNCTION public.living_refuse_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION '% is insert-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $$;
REVOKE ALL ON FUNCTION public.living_refuse_change() FROM PUBLIC;

GRANT SELECT ON public.living_editions, public.living_moves, public.living_edition_status TO anon, authenticated;
GRANT ALL ON public.living_editions, public.living_moves, public.living_edition_status TO service_role;
ALTER TABLE public.living_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.living_edition_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Editions are public" ON public.living_editions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Edition moves are public" ON public.living_moves FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Edition statuses are public" ON public.living_edition_status FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER living_editions_insert_only BEFORE UPDATE OR DELETE ON public.living_editions FOR EACH ROW EXECUTE FUNCTION public.living_refuse_change();
CREATE TRIGGER living_moves_insert_only BEFORE UPDATE OR DELETE ON public.living_moves FOR EACH ROW EXECUTE FUNCTION public.living_refuse_change();
CREATE TRIGGER living_edition_status_insert_only BEFORE UPDATE OR DELETE ON public.living_edition_status FOR EACH ROW EXECUTE FUNCTION public.living_refuse_change();

INSERT INTO public.living_editions (number, dated, "values") VALUES
  (0, DATE '2026-11-21', '{"radius":0,"tracking":0,"density":4,"motion":240,"accent":"pink","chart":1,"covers":["card","chart"],"motifs":["cut","trail","soft"]}'::jsonb);
INSERT INTO public.living_edition_status (edition, status, note, at) VALUES
  (0, 'baseline', 'Edition 0: today''s values of every setting, unchanged.', TIMESTAMPTZ '2026-11-21 18:30:00+00');