-- Supply: first snapshot date per Google Fonts family (public data; invoker rights keep the base table's policy).
CREATE VIEW public.gfont_first_seen WITH (security_invoker=true) AS
SELECT family, (array_agg(category ORDER BY captured_on DESC))[1] AS category, min(captured_on) AS first_seen
FROM public.gfont_snapshots GROUP BY family;
GRANT SELECT ON public.gfont_first_seen TO anon, authenticated, service_role;
-- Cached discovery results for conditional (304) polling, private like the rest of source_cursors.
ALTER TABLE public.source_cursors ADD COLUMN state jsonb;