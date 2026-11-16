CREATE TABLE public.site_crops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain text NOT NULL,
  section text NOT NULL CHECK (section IN ('hero', 'nav', 'pricing', 'cta', 'footer')),
  viewport text NOT NULL DEFAULT 'desktop' CHECK (viewport IN ('desktop')),
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
  CHECK (last_seen_at >= first_seen_at)
);
CREATE INDEX site_crops_domain_section_idx ON public.site_crops (domain, section, viewport, captured_at DESC);
COMMENT ON TABLE public.site_crops IS 'Section crops (hero/nav/pricing/cta/footer) of tracked homepages; image bytes live in the private site-crops bucket. Max 12 versions per domain+section; same perceptual hash only advances last_seen_at.';

CREATE OR REPLACE FUNCTION public.crop_opted_out(p_domain text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.thumb_optouts o WHERE o.domain = p_domain) $$;
REVOKE ALL ON FUNCTION public.crop_opted_out(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crop_opted_out(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.site_crops_refuse_optout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.thumb_optouts o WHERE o.domain = NEW.domain) THEN
    RAISE EXCEPTION 'crop opt-out for %', NEW.domain USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.site_crops_refuse_optout() FROM PUBLIC;

GRANT SELECT ON public.site_crops TO anon, authenticated;
GRANT ALL ON public.site_crops TO service_role;
ALTER TABLE public.site_crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crops of sites that have not opted out are readable" ON public.site_crops FOR SELECT TO anon, authenticated USING (NOT public.crop_opted_out(domain));

CREATE TRIGGER site_crops_refuse_optout BEFORE INSERT OR UPDATE ON public.site_crops FOR EACH ROW EXECUTE FUNCTION public.site_crops_refuse_optout();