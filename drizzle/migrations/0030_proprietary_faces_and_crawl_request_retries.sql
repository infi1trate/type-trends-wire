ALTER TABLE public.font_catalog DROP CONSTRAINT IF EXISTS font_catalog_license_hint_check;
ALTER TABLE public.font_catalog ADD CONSTRAINT font_catalog_license_hint_check CHECK (license_hint IN ('free','commercial','system','proprietary'));
ALTER TABLE public.crawl_requests ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.crawl_requests ADD COLUMN IF NOT EXISTS last_error text;
ALTER TABLE public.crawl_requests ADD COLUMN IF NOT EXISTS done_at timestamptz;
ALTER TABLE public.crawl_requests ADD CONSTRAINT crawl_requests_attempts_check CHECK (attempts >= 0);
ALTER TABLE public.crawl_requests ADD CONSTRAINT crawl_requests_last_error_check CHECK (last_error IS NULL OR char_length(last_error) <= 300);
CREATE INDEX IF NOT EXISTS crawl_requests_pending_idx ON public.crawl_requests (requested_at, url) WHERE status = 'pending';