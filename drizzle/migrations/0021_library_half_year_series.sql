CREATE FUNCTION public.library_half_year(t timestamptz) RETURNS date LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT make_date(extract(year FROM t AT TIME ZONE 'UTC')::int,CASE WHEN extract(month FROM t AT TIME ZONE 'UTC')<=6 THEN 1 ELSE 7 END,1); $$;
CREATE FUNCTION public.library_number(j jsonb) RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE WHEN jsonb_typeof(j)='number' THEN j::text::double precision END; $$;
CREATE VIEW public.library_history_samples WITH(security_invoker=true) AS
WITH current_live AS (SELECT DISTINCT ON(domain) * FROM public.library_snapshots WHERE source='live' AND page_type='home' AND viewport='desktop' ORDER BY domain,captured_at DESC,id DESC), candidates AS (
 SELECT s.*,public.library_half_year(s.captured_at) bucket FROM public.library_snapshots s WHERE source='wayback' AND page_type='home' AND viewport='desktop'
 UNION ALL SELECT s.*,public.library_half_year(now()) bucket FROM current_live s
), selected AS (SELECT DISTINCT ON(domain,bucket) * FROM candidates ORDER BY domain,bucket,(source='live') DESC,captured_at DESC,id DESC)
SELECT c.id,c.domain,c.bucket,c.captured_at,c.source,c.signals,s.sector FROM selected c JOIN public.library_sites s USING(domain) WHERE s.active=true;
GRANT SELECT ON public.library_history_samples TO anon,authenticated,service_role;
CREATE VIEW public.library_history_coverage WITH(security_invoker=true) AS
WITH sectors AS (SELECT sector,count(*) active_sites FROM public.library_sites WHERE active=true GROUP BY sector UNION ALL SELECT 'all',count(*) FROM public.library_sites WHERE active=true), buckets AS (SELECT generate_series('2021-01-01'::date,public.library_half_year(now()),interval '6 months')::date bucket), counts AS (SELECT bucket,sector,count(*) sites FROM public.library_history_samples GROUP BY bucket,sector UNION ALL SELECT bucket,'all',count(*) FROM public.library_history_samples GROUP BY bucket)
SELECT b.bucket,s.sector,coalesce(c.sites,0)::bigint sites,coalesce(c.sites,0)::double precision/nullif(s.active_sites,0) coverage FROM buckets b CROSS JOIN sectors s LEFT JOIN counts c USING(bucket,sector);
GRANT SELECT ON public.library_history_coverage TO anon,authenticated,service_role;
CREATE VIEW public.library_signal_series WITH(security_invoker=true) AS
WITH expanded AS (SELECT *,sector scope FROM public.library_history_samples UNION ALL SELECT *,'all' scope FROM public.library_history_samples), aggregates AS (
SELECT bucket,scope sector,
avg((signals#>>'{color,theme}'='dark')::int) dark_theme_share,
avg((signals#>>'{type,rendered,h1,family}' ~* '(serif|georgia|times|garamond|canela|tiempos|lora|fraunces|playfair|editorial|domaine|recoleta)' AND signals#>>'{type,rendered,h1,family}' !~* 'sans')::int) serif_h1_share,
avg((signals#>>'{type,rendered,body,webfont}'='true')::int) webfont_share,
avg((signals#>>'{type,rendered,body,family}' ~* '(system-ui|arial|helvetica|segoe|san francisco|sans-serif)')::int) system_ui_body_share,
percentile_cont(0.5) WITHIN GROUP(ORDER BY public.library_number(coalesce(signals#>'{composition,whitespace_ratio}',signals#>'{color,whitespace_ratio}'))) median_whitespace,
percentile_cont(0.5) WITHIN GROUP(ORDER BY public.library_number(signals#>'{type,declared,h1,size_px}')) median_h1_px,
avg((public.library_number(signals#>'{type,declared,h1,letter_spacing_em}')<=-0.02)::int) tight_tracking_share,
avg((public.library_number(signals#>'{layout,cta_radius_px}')>24)::int) pill_cta_share,
avg((signals#>>'{layout,hero_media}'='webgl')::int) webgl_hero_share,
avg((signals#>>'{layout,hero_media}'='video')::int) video_hero_share,
avg((signals#>>'{tech,tailwind}'='true')::int) tailwind_share,
avg((signals#>>'{tech,framer}'='true')::int) framer_share,
avg((signals#>>'{tech,webflow}'='true')::int) webflow_share,
avg((signals#>>'{tech,next}'='true')::int) next_share
FROM expanded GROUP BY bucket,scope)
SELECT c.bucket,c.sector,c.sites,a.dark_theme_share,a.serif_h1_share,a.webfont_share,a.system_ui_body_share,a.median_whitespace,a.median_h1_px,a.tight_tracking_share,a.pill_cta_share,a.webgl_hero_share,a.video_hero_share,a.tailwind_share,a.framer_share,a.webflow_share,a.next_share,c.coverage,(c.coverage<0.3) low_coverage FROM public.library_history_coverage c LEFT JOIN aggregates a USING(bucket,sector);
GRANT SELECT ON public.library_signal_series TO anon,authenticated,service_role;
CREATE VIEW public.library_css_series WITH(security_invoker=true) AS
WITH features AS (SELECT DISTINCT jsonb_array_elements_text(CASE WHEN jsonb_typeof(signals->'css_features')='array' THEN signals->'css_features' ELSE '[]'::jsonb END) feature FROM public.library_history_samples UNION SELECT unnest(ARRAY['container_queries','has_selector','view_transitions','scroll_timeline','oklch','color_mix','cascade_layers','nesting','text_wrap_balance','dvh_units','subgrid'])), expanded AS (SELECT *,sector scope FROM public.library_history_samples UNION ALL SELECT *,'all' FROM public.library_history_samples)
SELECT c.bucket,c.sector,f.feature,avg((coalesce(e.signals->'css_features','[]'::jsonb)?f.feature)::int) share,c.sites,c.coverage,(c.coverage<0.3) low_coverage FROM public.library_history_coverage c CROSS JOIN features f LEFT JOIN expanded e ON e.bucket=c.bucket AND e.scope=c.sector GROUP BY c.bucket,c.sector,f.feature,c.sites,c.coverage;
GRANT SELECT ON public.library_css_series TO anon,authenticated,service_role;
CREATE VIEW public.library_font_series WITH(security_invoker=true) AS
WITH fonts AS (SELECT s.bucket,s.domain,r.role,s.signals#>>ARRAY['type','rendered',r.role,'family'] family FROM public.library_history_samples s CROSS JOIN (VALUES('h1'),('body')) r(role)), ranked AS (SELECT role,family,row_number() OVER(PARTITION BY role ORDER BY count(*) DESC,family) rank FROM fonts WHERE family IS NOT NULL GROUP BY role,family), counts AS (SELECT bucket,role,family,count(*) sites FROM fonts WHERE family IS NOT NULL GROUP BY bucket,role,family)
SELECT c.bucket,r.family,r.role,coalesce(n.sites,0)::bigint sites,CASE WHEN c.sites>0 THEN coalesce(n.sites,0)::double precision/c.sites END share,c.coverage,(c.coverage<0.3) low_coverage FROM public.library_history_coverage c CROSS JOIN ranked r LEFT JOIN counts n ON n.bucket=c.bucket AND n.role=r.role AND n.family=r.family WHERE c.sector='all' AND r.rank<=40;
GRANT SELECT ON public.library_font_series TO anon,authenticated,service_role;
CREATE VIEW public.library_tag_series WITH(security_invoker=true) AS
WITH eligible AS (SELECT s.*,t.tags FROM public.library_history_samples s JOIN public.library_tags t ON t.snapshot_id=s.id WHERE coalesce((t.tags->>'confidence')::numeric,0)>=0.4 AND coalesce(t.tags->>'low_confidence','false')<>'true' AND t.tags->>'blocked_reason' IS NULL), expanded AS (SELECT *,sector scope FROM eligible UNION ALL SELECT *,'all' FROM eligible), dimensions AS (SELECT e.bucket,e.scope sector,e.domain,d.key dimension,v.value FROM expanded e CROSS JOIN LATERAL jsonb_each(e.tags) d CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(d.value)='array' THEN d.value WHEN jsonb_typeof(d.value)='string' THEN jsonb_build_array(d.value) ELSE '[]'::jsonb END) v(value) WHERE d.key IN ('imagery','aesthetic','components','hero_layout','ai_positioning','tone','color_mood')), vocab AS (SELECT DISTINCT dimension,value FROM dimensions), totals AS (SELECT bucket,scope sector,count(*) tagged_sites FROM expanded GROUP BY bucket,scope), counts AS (SELECT bucket,sector,dimension,value,count(DISTINCT domain) n FROM dimensions GROUP BY bucket,sector,dimension,value)
SELECT c.bucket,c.sector,v.dimension,v.value,CASE WHEN t.tagged_sites>0 THEN coalesce(n.n,0)::double precision/t.tagged_sites END share,coalesce(t.tagged_sites,0)::bigint tagged_sites,c.coverage,(c.coverage<0.3) low_coverage FROM public.library_history_coverage c CROSS JOIN vocab v LEFT JOIN totals t USING(bucket,sector) LEFT JOIN counts n ON n.bucket=c.bucket AND n.sector=c.sector AND n.dimension=v.dimension AND n.value=v.value;
GRANT SELECT ON public.library_tag_series TO anon,authenticated,service_role;