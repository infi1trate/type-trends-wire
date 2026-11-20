ALTER TABLE public.headline_calls DROP CONSTRAINT headline_calls_pkey;
ALTER TABLE public.headline_calls ADD COLUMN id bigint GENERATED ALWAYS AS IDENTITY;
ALTER TABLE public.headline_calls ADD CONSTRAINT headline_calls_pkey PRIMARY KEY (id);
CREATE INDEX headline_calls_event_latest ON public.headline_calls (event_id, created_at DESC, id DESC);
COMMENT ON TABLE public.headline_calls IS 'Editor calls on live headline changes (library_events message_pivot): position, product rotation, promotion or unclear, with a one-sentence reason. Insert-only; a later row for the same event supersedes earlier ones (a re-checked rule or a desk decision).';