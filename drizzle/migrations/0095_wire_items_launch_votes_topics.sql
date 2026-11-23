ALTER TABLE public.wire_items ADD COLUMN IF NOT EXISTS votes integer CHECK (votes IS NULL OR votes >= 0);
ALTER TABLE public.wire_items ADD COLUMN IF NOT EXISTS topics text[] CHECK (topics IS NULL OR cardinality(topics) <= 20);
COMMENT ON COLUMN public.wire_items.votes IS 'Product Hunt launches: upvotes when the finished launch day was read; null for other sources.';
COMMENT ON COLUMN public.wire_items.topics IS 'Product Hunt launches: topic slugs; null when topics could not be read, empty when the post has none.';