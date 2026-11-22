-- N4b · the share-image and study-chart checks run in small scheduled passes: a start row before any work (unique ten-minute slot,
-- so never two passes at once) and one finish row after. Append-only, service role only (the N2 pattern).
CREATE TABLE public.desk_passes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  check_name text NOT NULL CHECK (check_name IN ('share', 'chart')),
  day date NOT NULL,
  slot text NOT NULL UNIQUE CHECK (char_length(slot) BETWEEN 10 AND 40),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND pg_column_size(items) <= 4096),
  plan jsonb CHECK (plan IS NULL OR (jsonb_typeof(plan) = 'array' AND pg_column_size(plan) <= 65536)),
  actor text NOT NULL DEFAULT 'graphics' CHECK (actor IN ('graphics', 'engineering'))
);
GRANT ALL ON public.desk_passes TO service_role;
ALTER TABLE public.desk_passes ENABLE ROW LEVEL SECURITY;
CREATE INDEX desk_passes_day_idx ON public.desk_passes (day, id);
CREATE TRIGGER desk_passes_insert_only BEFORE UPDATE OR DELETE ON public.desk_passes FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();

CREATE TABLE public.desk_pass_ends (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  pass_id bigint NOT NULL UNIQUE REFERENCES public.desk_passes(id),
  ok boolean NOT NULL,
  ms integer NOT NULL CHECK (ms >= 0),
  results jsonb NOT NULL CHECK (jsonb_typeof(results) = 'array' AND pg_column_size(results) <= 16384),
  rows_written integer NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
  error text CHECK (char_length(error) <= 300)
);
GRANT ALL ON public.desk_pass_ends TO service_role;
ALTER TABLE public.desk_pass_ends ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER desk_pass_ends_insert_only BEFORE UPDATE OR DELETE ON public.desk_pass_ends FOR EACH ROW EXECUTE FUNCTION public.newsroom_refuse_change();