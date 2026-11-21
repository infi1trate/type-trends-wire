CREATE TABLE public.crop_quality (
  path text PRIMARY KEY CHECK (char_length(path) BETWEEN 1 AND 400),
  lead_ok boolean NOT NULL,
  reason text CHECK (reason IS NULL OR char_length(reason) <= 120),
  luma_std numeric,
  top_share numeric,
  edge_mean numeric,
  bytes_per_px numeric,
  method text NOT NULL CHECK (method IN ('pixels')),
  computed_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.crop_quality IS 'I3: whether a stored section crop may be a lead picture (not near-blank or flat, source at least 480 px wide), measured once from its pixels. A crop without a row is judged by its stored size and byte density (src/lib/lead-picture.ts). Derived only; removing a crop leaves its row unused.';
GRANT SELECT ON public.crop_quality TO anon, authenticated;
GRANT ALL ON public.crop_quality TO service_role;
ALTER TABLE public.crop_quality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read crop quality" ON public.crop_quality FOR SELECT TO anon, authenticated USING (true);