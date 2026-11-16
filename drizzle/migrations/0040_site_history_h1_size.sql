SET LOCAL search_path = public, pg_catalog;
CREATE OR REPLACE VIEW public.library_site_history WITH (security_invoker=true) AS
WITH live AS (
         SELECT DISTINCT ON (library_snapshots.domain) library_snapshots.id,
            library_snapshots.domain,
            library_snapshots.page_type,
            library_snapshots.viewport,
            library_snapshots.source,
            library_snapshots.captured_at,
            library_snapshots.url,
            library_snapshots.run_id,
            library_snapshots.html_hash,
            library_snapshots.content_hash,
            library_snapshots.signals_hash,
            library_snapshots.signals
           FROM library_snapshots
          WHERE ((library_snapshots.source = 'live'::text) AND (library_snapshots.page_type = 'home'::text) AND (library_snapshots.viewport = 'desktop'::text))
          ORDER BY library_snapshots.domain, library_snapshots.captured_at DESC, library_snapshots.id DESC
        ), candidates AS (
         SELECT s_1.id,
            s_1.domain,
            s_1.page_type,
            s_1.viewport,
            s_1.source,
            s_1.captured_at,
            s_1.url,
            s_1.run_id,
            s_1.html_hash,
            s_1.content_hash,
            s_1.signals_hash,
            s_1.signals,
            library_quarter(s_1.captured_at) AS quarter
           FROM library_snapshots s_1
          WHERE ((s_1.source = 'wayback'::text) AND (s_1.page_type = 'home'::text) AND (s_1.viewport = 'desktop'::text))
        UNION ALL
         SELECT l_1.id,
            l_1.domain,
            l_1.page_type,
            l_1.viewport,
            l_1.source,
            l_1.captured_at,
            l_1.url,
            l_1.run_id,
            l_1.html_hash,
            l_1.content_hash,
            l_1.signals_hash,
            l_1.signals,
            library_quarter(now()) AS library_quarter
           FROM live l_1
        ), samples AS (
         SELECT DISTINCT ON (candidates.domain, candidates.quarter) candidates.id,
            candidates.domain,
            candidates.page_type,
            candidates.viewport,
            candidates.source,
            candidates.captured_at,
            candidates.url,
            candidates.run_id,
            candidates.html_hash,
            candidates.content_hash,
            candidates.signals_hash,
            candidates.signals,
            candidates.quarter
           FROM candidates
          ORDER BY candidates.domain, candidates.quarter, (candidates.source = 'live'::text) DESC, candidates.captured_at DESC, candidates.id DESC
        )
 SELECT s.domain,
    s.quarter,
    s.captured_at,
    s.source,
    (s.source = 'live'::text) AS now,
    s.id AS snapshot_id,
    l.sector,
    library_history_family(s.signals, 'h1'::text, s.source) AS h1_family,
    library_history_family(s.signals, 'body'::text, s.source) AS body_family,
    (s.signals #>> '{color,theme}'::text[]) AS theme,
    (s.signals #>> '{color,accent}'::text[]) AS accent,
    (s.signals #>> '{color,page_bg}'::text[]) AS page_bg,
    library_number(COALESCE((s.signals #> '{composition,whitespace_ratio}'::text[]), (s.signals #> '{color,whitespace_ratio}'::text[]))) AS whitespace_ratio,
    (s.signals #>> '{layout,hero_media}'::text[]) AS hero_media,
    library_number((s.signals #> '{layout,grid_max_cols}'::text[])) AS grid_max_cols,
        CASE
            WHEN (library_number((s.signals #> '{layout,cta_radius_px}'::text[])) = (0)::double precision) THEN '0'::text
            WHEN (library_number((s.signals #> '{layout,cta_radius_px}'::text[])) <= (8)::double precision) THEN '1–8'::text
            WHEN (library_number((s.signals #> '{layout,cta_radius_px}'::text[])) <= (24)::double precision) THEN '9–24'::text
            WHEN (library_number((s.signals #> '{layout,cta_radius_px}'::text[])) > (24)::double precision) THEN 'pill'::text
            ELSE NULL::text
        END AS cta_radius_bucket,
    COALESCE((s.signals -> 'css_features'::text), '[]'::jsonb) AS css_features,
    COALESCE((s.signals -> 'tech'::text), '{}'::jsonb) AS frameworks,
        CASE
            WHEN (s.source = 'wayback'::text) THEN (library_history_family(s.signals, 'body'::text, s.source) !~* '^(systemui|serif|sansserif|arial|helvetica|georgia|timesnewroman|monospace)$'::text)
            ELSE ((s.signals #>> '{type,rendered,body,webfont}'::text[]) = 'true'::text)
        END AS webfont,
    library_number((s.signals #> '{type,declared,h1,letter_spacing_em}'::text[])) AS h1_tracking,
        CASE
            WHEN ((COALESCE(library_number((t.tags -> 'confidence'::text)), (0)::double precision) >= (0.4)::double precision) AND (COALESCE((t.tags ->> 'low_confidence'::text), 'false'::text) <> 'true'::text) AND ((t.tags ->> 'blocked_reason'::text) IS NULL)) THEN t.tags
            ELSE '{}'::jsonb
        END AS ai_tags,
    library_number((s.signals #> '{type,declared,h1,size_px}'::text[])) AS h1_size_px
   FROM ((samples s
     JOIN library_sites l USING (domain))
     LEFT JOIN library_tags t ON ((t.snapshot_id = s.id)))
  WHERE (l.active = true);
COMMENT ON COLUMN public.library_site_history.h1_size_px IS 'Declared H1 font size in px (added for composite signals such as Big type).';
GRANT SELECT ON public.library_site_history TO anon,authenticated,service_role;