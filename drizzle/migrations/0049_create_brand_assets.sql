CREATE TABLE public.brand_assets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('icon', 'card')),
  captured_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  path text NOT NULL UNIQUE,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1280),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 153600),
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{16,64}$'),
  run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (last_seen_at >= first_seen_at),
  CHECK (kind <> 'icon' OR (width BETWEEN 48 AND 256 AND height BETWEEN 48 AND 256))
);
CREATE INDEX brand_assets_domain_kind_idx ON public.brand_assets (domain, kind, captured_at DESC);
COMMENT ON TABLE public.brand_assets IS 'Brand-published assets of tracked sites: site icon (icon) and social share image (card), re-encoded WebP. Bytes live in the private site-crops bucket under assets/. Max 12 versions per domain+kind; same hash only advances last_seen_at.';

GRANT SELECT ON public.brand_assets TO anon, authenticated;
GRANT ALL ON public.brand_assets TO service_role;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assets of sites that have not opted out are readable" ON public.brand_assets FOR SELECT TO anon, authenticated USING (NOT public.crop_opted_out(domain));

CREATE TRIGGER brand_assets_refuse_optout BEFORE INSERT OR UPDATE ON public.brand_assets FOR EACH ROW EXECUTE FUNCTION public.site_crops_refuse_optout();