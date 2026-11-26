CREATE TABLE public.app_listings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store text NOT NULL,
  app_id text NOT NULL,
  name text NOT NULL,
  maker text NOT NULL,
  link text NOT NULL,
  genre text,
  site text,
  first_at timestamptz,
  about text,
  about_chars integer NOT NULL DEFAULT 0,
  about_words integer NOT NULL DEFAULT 0,
  about_changed_at timestamptz,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_reason text,
  CONSTRAINT app_listings_store_app_key UNIQUE (store, app_id)
);
GRANT ALL ON public.app_listings TO service_role;
ALTER TABLE public.app_listings ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_listings_site_idx ON public.app_listings (site);

CREATE TABLE public.app_listing_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store text NOT NULL,
  app_id text NOT NULL,
  version text NOT NULL DEFAULT '',
  version_at timestamptz,
  notes text,
  notes_chars integer NOT NULL DEFAULT 0,
  price numeric,
  currency text,
  size_mb numeric,
  min_os text,
  languages integer,
  age text,
  shots jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_versions_key UNIQUE (store, app_id, version)
);
GRANT ALL ON public.app_listing_versions TO service_role;
ALTER TABLE public.app_listing_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX app_listing_versions_app_at_idx ON public.app_listing_versions (app_id, version_at);

CREATE TABLE public.app_listing_weeks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week text NOT NULL,
  store text NOT NULL,
  chart text NOT NULL,
  genre_id integer NOT NULL,
  app_id text NOT NULL,
  genre_name text NOT NULL,
  day date NOT NULL,
  rank integer NOT NULL,
  rating numeric,
  ratings integer,
  version text NOT NULL DEFAULT '',
  stored_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_listing_weeks_key UNIQUE (week, store, chart, genre_id, app_id)
);
GRANT ALL ON public.app_listing_weeks TO service_role;
ALTER TABLE public.app_listing_weeks ENABLE ROW LEVEL SECURITY;