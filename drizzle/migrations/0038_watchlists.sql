CREATE TABLE public.watchlists (
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{22}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  sites text[] NOT NULL DEFAULT '{}' CHECK (cardinality(sites) <= 25),
  pending_sites text[] NOT NULL DEFAULT '{}' CHECK (cardinality(pending_sites) <= 25),
  traits text[] NOT NULL DEFAULT '{}' CHECK (cardinality(traits) <= 25),
  sectors text[] NOT NULL DEFAULT '{}' CHECK (cardinality(sectors) <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edit_token_sha256 text NOT NULL CHECK (edit_token_sha256 ~ '^[0-9a-f]{64}$'),
  feed_token text NOT NULL UNIQUE CHECK (feed_token ~ '^[A-Za-z0-9_-]{22}$'),
  last_viewed_at timestamptz,
  CONSTRAINT watchlists_site_total CHECK (cardinality(sites) + cardinality(pending_sites) <= 25),
  CONSTRAINT watchlists_feed_not_id CHECK (feed_token <> id)
);
GRANT ALL ON public.watchlists TO service_role;
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.watchlists IS 'Capability-link watchlists. No anon/authenticated access: reads and writes go through server code with the service role, so ids cannot be enumerated. Only the sha256 of the edit token is stored.';