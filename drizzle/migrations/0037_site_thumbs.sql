CREATE TABLE public.thumb_optouts (
  domain text PRIMARY KEY CHECK (domain = lower(domain) AND length(domain) BETWEEN 3 AND 253),
  created_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR length(note) <= 500)
);
GRANT ALL ON public.thumb_optouts TO service_role;
ALTER TABLE public.thumb_optouts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_thumbs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  domain text NOT NULL CHECK (domain = lower(domain)),
  captured_at timestamptz NOT NULL,
  viewport text NOT NULL CHECK (viewport IN ('desktop', 'mobile')),
  path text NOT NULL UNIQUE,
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1280),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 800),
  bytes integer NOT NULL CHECK (bytes BETWEEN 1 AND 153600),
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_run_id text,
  removed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain, viewport, captured_at)
);
CREATE INDEX site_thumbs_latest ON public.site_thumbs (domain, viewport, captured_at DESC);
GRANT SELECT ON public.site_thumbs TO anon, authenticated;
GRANT ALL ON public.site_thumbs TO service_role;
ALTER TABLE public.site_thumbs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible thumbnails are public" ON public.site_thumbs FOR SELECT TO anon, authenticated USING (removed_at IS NULL);

-- Opt-outs hide existing rows at once (even when added by SQL) and refuse new ones.
CREATE OR REPLACE FUNCTION public.thumb_optout_hide() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.site_thumbs SET removed_at = now() WHERE domain = NEW.domain AND removed_at IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER thumb_optouts_hide AFTER INSERT ON public.thumb_optouts FOR EACH ROW EXECUTE FUNCTION public.thumb_optout_hide();

CREATE OR REPLACE FUNCTION public.site_thumbs_refuse_optout() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.thumb_optouts o WHERE o.domain = NEW.domain) THEN
    RAISE EXCEPTION 'thumbnail opt-out for %', NEW.domain USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER site_thumbs_refuse_optout BEFORE INSERT ON public.site_thumbs FOR EACH ROW EXECUTE FUNCTION public.site_thumbs_refuse_optout();
REVOKE EXECUTE ON FUNCTION public.thumb_optout_hide() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.site_thumbs_refuse_optout() FROM PUBLIC, anon, authenticated;