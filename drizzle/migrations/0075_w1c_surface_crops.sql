CREATE TABLE public.surface_crops (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain text NOT NULL,
  section text NOT NULL CHECK (section IN ('product', 'about', 'pricing_page')),
  viewport text NOT NULL DEFAULT 'desktop' CHECK (viewport IN ('desktop')),
  captured_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  path text NOT NULL UNIQUE,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1280),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 800),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 153600),
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{16,64}$'),
  run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (last_seen_at >= first_seen_at)
);
CREATE INDEX surface_crops_domain_section_idx ON public.surface_crops (domain, section, viewport, captured_at DESC);
COMMENT ON TABLE public.surface_crops IS 'W1c: first-screen crops of a tracked brand''s product, about and pricing pages, governed like site_crops (WebP, at most 1280x800 and 150 KB, 12 versions per domain+section, same bucket, credited and linked, opt-out deletes them, quality measured on arrival into crop_quality).';

CREATE OR REPLACE FUNCTION public.surface_crops_refuse_optout()
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
REVOKE ALL ON FUNCTION public.surface_crops_refuse_optout() FROM PUBLIC;

GRANT SELECT ON public.surface_crops TO anon, authenticated;
GRANT ALL ON public.surface_crops TO service_role;
ALTER TABLE public.surface_crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Surface crops of sites that have not opted out are readable" ON public.surface_crops FOR SELECT TO anon, authenticated USING (NOT public.crop_opted_out(domain));

CREATE TRIGGER surface_crops_refuse_optout BEFORE INSERT OR UPDATE ON public.surface_crops FOR EACH ROW EXECUTE FUNCTION public.surface_crops_refuse_optout();