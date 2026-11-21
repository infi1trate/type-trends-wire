-- The helper added in u2b_site_history_rows_and_snapshot_fields still re-read the toasted value per path; concatenating with an empty
-- object materialises one in-memory copy, so the eight paths read memory.
CREATE OR REPLACE FUNCTION public.library_snapshot_check_fields(s jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 PARALLEL SAFE
 SET search_path TO ''
AS $function$
DECLARE d jsonb := s || '{}'::jsonb;
BEGIN
 RETURN jsonb_build_object(
  'rendered', d #> '{type,rendered}', 'color', d -> 'color', 'layout', d -> 'layout', 'h1', d #> '{lexicon,h1}',
  'nav', d -> 'nav', 'prices', d -> 'prices', 'tech', d -> 'tech', 'ai_pricing', d -> 'ai_pricing');
END; $function$;