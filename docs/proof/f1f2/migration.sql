CREATE TABLE public.brand_kit_records (
  domain text PRIMARY KEY,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brand_kit_records TO anon, authenticated;
GRANT ALL ON public.brand_kit_records TO service_role;
ALTER TABLE public.brand_kit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.brand_kit_records FOR SELECT TO anon, authenticated USING (true);