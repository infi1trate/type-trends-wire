-- U2c · item 5. The stored integrity fields keep only the nav entries the comparison reads (depth-0 items' depth and label,
-- in order; library-diff.ts extractFields filters depth === 0 and reads label), so a 100-capture read sends ~half the bytes.
CREATE FUNCTION public.library_snapshot_check_fields_slim(s jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO ''
AS $function$
DECLARE d jsonb := s || '{}'::jsonb; nav jsonb := d -> 'nav';
BEGIN
 IF jsonb_typeof(nav) = 'array' THEN
  nav := COALESCE((SELECT jsonb_agg(jsonb_build_object('depth', x.e -> 'depth', 'label', x.e -> 'label') ORDER BY x.ord)
                   FROM jsonb_array_elements(nav) WITH ORDINALITY x(e, ord) WHERE x.e -> 'depth' = '0'::jsonb), '[]'::jsonb);
 END IF;
 RETURN jsonb_build_object(
  'rendered', d #> '{type,rendered}', 'color', d -> 'color', 'layout', d -> 'layout', 'h1', d #> '{lexicon,h1}',
  'nav', nav, 'prices', d -> 'prices', 'tech', d -> 'tech', 'ai_pricing', d -> 'ai_pricing');
END; $function$;
GRANT EXECUTE ON FUNCTION public.library_snapshot_check_fields_slim(jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.library_snapshots_derive_ins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.library_snapshot_check_store (snapshot_id, check_fields)
    SELECT n.id, public.library_snapshot_check_fields_slim(n.signals) FROM n ON CONFLICT (snapshot_id) DO NOTHING;
  PERFORM public.library_history_mark(ARRAY(SELECT DISTINCT n.domain FROM n WHERE n.page_type = 'home' AND n.viewport = 'desktop'));
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.library_snapshots_derive_upd() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.library_snapshot_check_store (snapshot_id, check_fields)
    SELECT n.id, public.library_snapshot_check_fields_slim(n.signals) FROM n
    ON CONFLICT (snapshot_id) DO UPDATE SET check_fields = EXCLUDED.check_fields;
  PERFORM public.library_history_mark(ARRAY(
    SELECT n.domain FROM n WHERE n.page_type = 'home' AND n.viewport = 'desktop'
    UNION SELECT o.domain FROM o WHERE o.page_type = 'home' AND o.viewport = 'desktop'));
  RETURN NULL;
END $$;

-- Backfill of the derived table created in the previous U2c migration (its rows are this job's own derived copy).
UPDATE public.library_snapshot_check_store c SET check_fields = public.library_snapshot_check_fields_slim(s.signals)
  FROM public.library_snapshots s WHERE s.id = c.snapshot_id;

CREATE OR REPLACE VIEW public.library_snapshot_fields WITH (security_invoker = true) AS
 SELECT s.id, s.domain, s.page_type, s.viewport, s.source, s.captured_at,
  s.signals -> 'layout' -> 'hero_carousel' AS hero_carousel,
  COALESCE(c.check_fields, public.library_snapshot_check_fields_slim(s.signals)) AS check_fields
 FROM public.library_snapshots s LEFT JOIN public.library_snapshot_check_store c ON c.snapshot_id = s.id;