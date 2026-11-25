CREATE TABLE public.library_lead_lag_series (
  signal text NOT NULL,
  quarter text NOT NULL,
  van_n integer NOT NULL DEFAULT 0,
  van_yes integer NOT NULL DEFAULT 0,
  rest_n integer NOT NULL DEFAULT 0,
  rest_yes integer NOT NULL DEFAULT 0,
  vanguard_size integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal, quarter)
);
GRANT SELECT ON public.library_lead_lag_series TO anon, authenticated;
GRANT ALL ON public.library_lead_lag_series TO service_role;
ALTER TABLE public.library_lead_lag_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.library_lead_lag_series FOR SELECT TO anon, authenticated USING (true);