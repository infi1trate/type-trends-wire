CREATE TABLE public.app_icons (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week text NOT NULL CHECK (week ~ '^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$'),
  day date NOT NULL,
  store text NOT NULL CHECK (store = 'us'),
  chart text NOT NULL CHECK (chart = 'top-free'),
  genre_id integer NOT NULL CHECK (genre_id >= 1),
  genre_name text NOT NULL CHECK (char_length(genre_name) BETWEEN 1 AND 60),
  rank integer NOT NULL CHECK (rank BETWEEN 1 AND 100),
  app_id text NOT NULL CHECK (app_id ~ '^[0-9]{1,20}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  maker text NOT NULL CHECK (char_length(maker) BETWEEN 1 AND 120),
  link text NOT NULL CHECK (link LIKE 'https://apps.apple.com/%' AND char_length(link) <= 300),
  palette jsonb NOT NULL CHECK (jsonb_typeof(palette) = 'array' AND jsonb_array_length(palette) BETWEEN 1 AND 8),
  run_id text NOT NULL CHECK (char_length(run_id) BETWEEN 1 AND 120),
  stored_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz NULL,
  removed_reason text NULL CHECK (removed_reason IS NULL OR char_length(removed_reason) BETWEEN 3 AND 300),
  CONSTRAINT app_icons_week_genre_app_key UNIQUE (week, store, chart, genre_id, app_id)
);
GRANT ALL ON public.app_icons TO service_role;
ALTER TABLE public.app_icons ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.app_icons IS 'W3d: measured icon colours of the US App Store top-free charts, one snapshot per ISO week per category; service role only (no reader policy); removed apps keep their rows with removed_at.';
CREATE INDEX app_icons_week_idx ON public.app_icons (week, genre_id);
CREATE INDEX app_icons_removed_idx ON public.app_icons (app_id) WHERE removed_at IS NOT NULL;