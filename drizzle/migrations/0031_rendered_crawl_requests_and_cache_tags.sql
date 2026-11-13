ALTER TABLE public.crawl_requests ADD COLUMN IF NOT EXISTS signals jsonb;
ALTER TABLE public.crawl_requests ADD COLUMN IF NOT EXISTS rendered_at timestamptz;
ALTER TABLE public.crawl_requests ADD CONSTRAINT crawl_requests_signals_object_check CHECK (signals IS NULL OR jsonb_typeof(signals) = 'object');
CREATE INDEX IF NOT EXISTS crawl_requests_domain_idx ON public.crawl_requests (domain);
COMMENT ON COLUMN public.crawl_requests.signals IS 'Private: rendered crawler signals for a queued LITE URL; service-role only.';
ALTER TABLE public.tool_cache ADD COLUMN IF NOT EXISTS namespace text;
ALTER TABLE public.tool_cache ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS tool_cache_namespace_idx ON public.tool_cache (namespace);
CREATE INDEX IF NOT EXISTS tool_cache_tags_idx ON public.tool_cache USING gin (tags);