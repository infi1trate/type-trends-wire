-- Latest picture of each kind per brand (site icon, social card, hero crop) for icons, covers and wireframe reveals: one indexed read.
-- security_invoker: the readers' own access applies, so opted-out brands stay hidden exactly as in brand_assets and site_crops.
CREATE VIEW public.brand_pictures WITH (security_invoker = true) AS
SELECT DISTINCT ON (domain, kind) domain, kind, path, width, height, captured_at
FROM (
  SELECT a.domain, a.kind, a.path, a.width, a.height, a.captured_at, a.id FROM public.brand_assets a
  UNION ALL
  SELECT c.domain, 'hero'::text AS kind, c.path, c.width, c.height, c.captured_at, c.id FROM public.site_crops c WHERE c.section = 'hero' AND c.viewport = 'desktop'
) x
ORDER BY domain, kind, captured_at DESC, id DESC;
COMMENT ON VIEW public.brand_pictures IS 'Latest icon, card and hero crop per brand (security_invoker; opted-out brands hidden by the underlying policies).';
GRANT SELECT ON public.brand_pictures TO anon, authenticated;
GRANT ALL ON public.brand_pictures TO service_role;