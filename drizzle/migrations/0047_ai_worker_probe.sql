ALTER TABLE public.library_ai_control ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.library_ai_control ADD COLUMN IF NOT EXISTS probed_at timestamptz;
COMMENT ON COLUMN public.library_ai_control.paused_at IS 'When the current pause began (set by the worker when it pauses).';
COMMENT ON COLUMN public.library_ai_control.probed_at IS 'When the paused worker last tried one probe job (at most once every 60 minutes).';

CREATE FUNCTION public.ai_pause_facts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT coalesce((SELECT jsonb_build_object('paused', c.paused, 'reason', c.reason, 'paused_at', c.paused_at, 'probed_at', c.probed_at) FROM public.library_ai_control c WHERE c.name = 'text'), '{}'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.ai_pause_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_pause_facts() TO anon, authenticated, service_role;

CREATE FUNCTION public.library_ai_probe_acquire(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE r text;
BEGIN
  UPDATE public.library_ai_control
     SET lease_token = p_token, lease_until = now() + interval '90 seconds', probed_at = now(), paused = false
   WHERE name = 'text' AND paused AND reason IN ('workspace_credits', 'rate_limited')
     AND (lease_until IS NULL OR lease_until < now())
     AND greatest(coalesce(paused_at, '-infinity'::timestamptz), coalesce(probed_at, '-infinity'::timestamptz)) <= now() - interval '60 minutes'
  RETURNING reason INTO r;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN jsonb_build_object('ok', true, 'reason', r);
END; $$;
REVOKE ALL ON FUNCTION public.library_ai_probe_acquire(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_ai_probe_acquire(uuid) TO service_role;

CREATE FUNCTION public.library_ai_probe_settle(p_token uuid, p_ok boolean, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_ok THEN
    UPDATE public.library_ai_control SET paused = false, reason = NULL, paused_at = NULL, lease_until = NULL, lease_token = NULL WHERE name = 'text' AND lease_token = p_token;
  ELSE
    UPDATE public.library_ai_control SET paused = true, reason = coalesce(p_reason, reason), lease_until = NULL, lease_token = NULL WHERE name = 'text' AND lease_token = p_token;
  END IF;
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.library_ai_probe_settle(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_ai_probe_settle(uuid, boolean, text) TO service_role;