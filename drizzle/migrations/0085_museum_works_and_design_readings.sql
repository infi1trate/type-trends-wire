CREATE TABLE public.art_works (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL CHECK (source IN ('met','aic')),
  source_id text NOT NULL CHECK (char_length(source_id) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  artist text NULL CHECK (artist IS NULL OR char_length(artist) <= 200),
  date_display text NOT NULL CHECK (char_length(date_display) <= 120),
  year_start integer NOT NULL CHECK (year_start BETWEEN -3000 AND 2030),
  year_end integer NOT NULL CHECK (year_end <= 2030),
  tradition text NOT NULL CHECK (char_length(tradition) BETWEEN 1 AND 80),
  movement text NULL CHECK (movement IS NULL OR char_length(movement) <= 80),
  kind text NOT NULL CHECK (kind IN ('painting','print','drawing','textile','other')),
  credit_line text NOT NULL CHECK (char_length(credit_line) <= 400),
  link text NOT NULL CHECK (link LIKE 'https://%' AND char_length(link) <= 500),
  licence text NOT NULL CHECK (licence = 'CC0'),
  palette jsonb NOT NULL CHECK (jsonb_typeof(palette) = 'array' AND jsonb_array_length(palette) BETWEEN 1 AND 8),
  thumb text NULL CHECK (thumb IS NULL OR char_length(thumb) <= 200),
  thumb_hash text NULL CHECK (thumb_hash IS NULL OR char_length(thumb_hash) <= 64),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 240),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 480),
  run_id text NULL CHECK (run_id IS NULL OR char_length(run_id) <= 120),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz NULL,
  removed_reason text NULL CHECK (removed_reason IS NULL OR char_length(removed_reason) BETWEEN 3 AND 300),
  CONSTRAINT art_works_years CHECK (year_end >= year_start),
  CONSTRAINT art_works_source_key UNIQUE (source, source_id)
);
GRANT SELECT ON public.art_works TO anon, authenticated;
GRANT ALL ON public.art_works TO service_role;
ALTER TABLE public.art_works ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Museum works not removed are public to read" ON public.art_works FOR SELECT TO anon, authenticated USING (removed_at IS NULL);
CREATE INDEX art_works_thumb_idx ON public.art_works (thumb);

CREATE TABLE public.living_readings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  read_at timestamptz NOT NULL DEFAULT now(),
  run_id text NULL CHECK (run_id IS NULL OR char_length(run_id) <= 120),
  edition integer NOT NULL CHECK (edition >= 0),
  signals jsonb NOT NULL CHECK (jsonb_typeof(signals) = 'array'),
  ready integer NOT NULL DEFAULT 0 CHECK (ready >= 0),
  proposed_edition integer NULL,
  note text NOT NULL CHECK (char_length(note) <= 600),
  CONSTRAINT living_readings_month_key UNIQUE (month)
);
GRANT SELECT ON public.living_readings TO anon, authenticated;
GRANT ALL ON public.living_readings TO service_role;
ALTER TABLE public.living_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Monthly design readings are public to read" ON public.living_readings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.living_readings_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'living_readings is insert-only';
END $$;
CREATE TRIGGER living_readings_insert_only BEFORE UPDATE OR DELETE ON public.living_readings FOR EACH ROW EXECUTE FUNCTION public.living_readings_insert_only();