CREATE TABLE public.library_event_marks (
  event_id bigint NOT NULL REFERENCES public.library_events(id),
  field text NOT NULL CHECK (char_length(field) BETWEEN 1 AND 80),
  kind text NOT NULL CHECK (kind IN ('reread', 'not_measured')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 200),
  marked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, field)
);
COMMENT ON TABLE public.library_event_marks IS 'I3: insert-only marks beside stored live changes. reread = an AI label changed but no measured look field did between the same two captures; not_measured = a detection or parsing failure (0 grid columns, a sub-cent or over-precise monthly price). Applied on every verdict read; the event itself is never deleted or rewritten.';
GRANT SELECT ON public.library_event_marks TO anon, authenticated;
GRANT ALL ON public.library_event_marks TO service_role;
ALTER TABLE public.library_event_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read event marks" ON public.library_event_marks FOR SELECT TO anon, authenticated USING (true);
CREATE FUNCTION public.library_event_marks_insert_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'library_event_marks is insert-only';
END
$$;
CREATE TRIGGER library_event_marks_insert_only BEFORE UPDATE OR DELETE ON public.library_event_marks FOR EACH ROW EXECUTE FUNCTION public.library_event_marks_insert_only();