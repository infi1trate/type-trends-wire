ALTER TABLE public.library_sites ADD COLUMN IF NOT EXISTS site_kind text NOT NULL DEFAULT 'standard' CONSTRAINT library_sites_site_kind_check CHECK (site_kind IN ('standard', 'merchandised', 'editorial'));
COMMENT ON COLUMN public.library_sites.site_kind IS 'standard | merchandised (storefront: accent, palette, hero and headline follow the promotion) | editorial (media: palette and hero follow the lead story). Seeded from src/lib/brands/seed.tsv.';

CREATE TABLE public.headline_calls (
  event_id bigint PRIMARY KEY,
  domain text NOT NULL,
  before_text text,
  after_text text,
  call text NOT NULL CHECK (call IN ('position', 'product_rotation', 'promotion', 'unclear')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 300),
  source text NOT NULL CHECK (source IN ('rule', 'model')),
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.headline_calls IS 'One editor call per live headline change (library_events message_pivot): position, product rotation, promotion or unclear, with a one-sentence reason. Insert-only.';
GRANT SELECT ON public.headline_calls TO anon, authenticated;
GRANT ALL ON public.headline_calls TO service_role;
ALTER TABLE public.headline_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Headline calls are public to read" ON public.headline_calls FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.headline_calls_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'headline_calls is insert-only';
END; $$;
CREATE TRIGGER headline_calls_no_change BEFORE UPDATE OR DELETE ON public.headline_calls FOR EACH ROW EXECUTE FUNCTION public.headline_calls_insert_only();