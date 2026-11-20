CREATE OR REPLACE FUNCTION public.story_writer_facts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'calls_today', (SELECT count(*) FROM public.ai_usage WHERE kind = 'story_why' AND model = 'openai/gpt-6.2-astra' AND snapshot_id IS NULL AND state <> 'rejected' AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'),
    'last_call_at', (SELECT max(created_at) FROM public.ai_usage WHERE kind = 'story_why' AND model = 'openai/gpt-6.2-astra' AND snapshot_id IS NULL AND state <> 'rejected'),
    'last_checked_at', (SELECT max(created_at) FROM public.story_texts WHERE checked)
  )
$$;
REVOKE ALL ON FUNCTION public.story_writer_facts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.story_writer_facts() TO anon, authenticated, service_role;