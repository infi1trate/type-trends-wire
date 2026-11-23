-- D1 Part 4 · the time limits a caller's statements run under (read by the jobs' health line; no data).
CREATE OR REPLACE FUNCTION public.db_session_limits()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT jsonb_build_object('role', current_user, 'statement_timeout', current_setting('statement_timeout'), 'lock_timeout', current_setting('lock_timeout'),
    'idle_in_transaction_session_timeout', current_setting('idle_in_transaction_session_timeout'), 'transaction_timeout', current_setting('transaction_timeout'));
$function$;
REVOKE ALL ON FUNCTION public.db_session_limits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.db_session_limits() TO anon, authenticated, service_role;