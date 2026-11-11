CREATE OR REPLACE VIEW public.library_sector_stats WITH (security_invoker=true) AS
SELECT l.sector,count(*) AS sites,count(l.last_snapshot_at) AS sites_snapshotted,
 avg((l.theme='dark')::int) FILTER (WHERE l.theme IS NOT NULL) AS dark_theme_share,
 avg((coalesce(h.signals#>>'{type,rendered,h1,category}',f.category,CASE WHEN l.h1_family ~* '(monospace|mono|sans)' THEN 'sans-serif' WHEN l.h1_family ~* '(serif|times|georgia|garamond|baskerville|bodoni|didot|caslon|playfair|lora|merriweather|literata|fraunces|tiempos|canela|domaine|editorial|recoleta|ivypresto)' THEN 'serif' ELSE 'unknown' END)='serif')::int) FILTER (WHERE l.h1_family IS NOT NULL) AS serif_headline_share,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY l.whitespace_ratio) AS median_whitespace_ratio,sum(l.events_30d) AS events_30d
FROM public.library_latest l
LEFT JOIN LATERAL (SELECT signals FROM public.library_snapshots WHERE domain=l.domain AND page_type='home' AND viewport='desktop' AND source='live' ORDER BY captured_at DESC LIMIT 1) h ON true
LEFT JOIN LATERAL (SELECT category FROM public.gfont_snapshots WHERE family=l.h1_family ORDER BY captured_on DESC LIMIT 1) f ON true
GROUP BY l.sector;
REVOKE ALL ON public.library_sector_stats FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.library_sector_stats TO anon,authenticated;