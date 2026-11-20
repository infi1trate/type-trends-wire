CREATE TABLE public.change_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id bigint NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('pass', 'seen_once', 'alternating', 'headline_element')),
  pass_fields text[] NOT NULL DEFAULT '{}',
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_checks_event_idx ON public.change_checks (event_id, id DESC);
COMMENT ON TABLE public.change_checks IS 'E2e measurement integrity: insert-only verdicts per live library change (two before, two after, one transition; headline element). The newest row per event applies.';
GRANT SELECT ON public.change_checks TO anon, authenticated;
GRANT ALL ON public.change_checks TO service_role;
ALTER TABLE public.change_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read change checks" ON public.change_checks FOR SELECT TO anon, authenticated USING (true);
CREATE FUNCTION public.change_checks_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'change_checks is insert-only';
END
$$;
CREATE TRIGGER change_checks_insert_only BEFORE UPDATE OR DELETE ON public.change_checks FOR EACH ROW EXECUTE FUNCTION public.change_checks_insert_only();
CREATE VIEW public.change_checks_latest WITH (security_invoker = true) AS
  SELECT DISTINCT ON (event_id) event_id, verdict, pass_fields, fields, checked_at
  FROM public.change_checks
  ORDER BY event_id, id DESC;
GRANT SELECT ON public.change_checks_latest TO anon, authenticated, service_role;