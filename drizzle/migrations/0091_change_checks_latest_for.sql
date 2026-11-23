CREATE OR REPLACE FUNCTION public.change_checks_latest_for(_ids bigint[])
RETURNS TABLE (event_id bigint, verdict text, pass_fields text[], fields jsonb, checked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT c.event_id, c.verdict, c.pass_fields, c.fields, c.checked_at
  FROM (SELECT DISTINCT unnest(_ids) AS id) e
  CROSS JOIN LATERAL (
    SELECT cc.event_id, cc.verdict, cc.pass_fields, cc.fields, cc.checked_at
    FROM public.change_checks cc
    WHERE cc.event_id = e.id
    ORDER BY cc.id DESC
    LIMIT 1
  ) c
$$;
COMMENT ON FUNCTION public.change_checks_latest_for(bigint[]) IS 'Newest change_checks row per event id (one index probe each); same rows as change_checks_latest filtered to the ids.';
REVOKE ALL ON FUNCTION public.change_checks_latest_for(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_checks_latest_for(bigint[]) TO anon, authenticated, service_role;