CREATE TABLE public.asset_grids (
  path text PRIMARY KEY CHECK (char_length(path) BETWEEN 1 AND 400),
  grid text NOT NULL CHECK (char_length(grid) BETWEEN 1 AND 8000),
  spread numeric NOT NULL,
  method text NOT NULL CHECK (method IN ('rgb32-white')),
  computed_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.asset_grids IS 'W1b: a stored site icon or social card reduced to a 32x32 colour grid on white (base64, 3072 bytes) and its spread, measured once from its pixels, so two versions can be compared perceptually (re-encodes and resizes do not count as changes). Derived; the picture itself stays in the crops bucket.';
GRANT SELECT ON public.asset_grids TO anon, authenticated;
GRANT ALL ON public.asset_grids TO service_role;
ALTER TABLE public.asset_grids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read asset grids" ON public.asset_grids FOR SELECT TO anon, authenticated USING (true);