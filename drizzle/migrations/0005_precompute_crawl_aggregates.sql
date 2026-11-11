-- Private live definitions; public facades expose only ok-site aggregates.
ALTER VIEW public.crawl_font_share RENAME TO crawl_font_share_live;
ALTER VIEW public.crawl_color_stats RENAME TO crawl_color_stats_live;
ALTER VIEW public.crawl_layout_share RENAME TO crawl_layout_share_live;
ALTER VIEW public.crawl_tech_share RENAME TO crawl_tech_share_live;
ALTER VIEW public.crawl_cta_phrases RENAME TO crawl_cta_phrases_live;
ALTER VIEW public.crawl_h1_words RENAME TO crawl_h1_words_live;
ALTER VIEW public.crawl_spread RENAME TO crawl_spread_live;
CREATE OR REPLACE VIEW public.crawl_spread_live WITH(security_invoker=true) AS
WITH gf AS MATERIALIZED (
 SELECT lower(family) family, bool_or(category='serif') is_serif, bool_or(category='monospace') is_mono
 FROM public.gfont_snapshots WHERE captured_on=(SELECT max(captured_on) FROM public.gfont_snapshots)
 GROUP BY lower(family)
), classified AS MATERIALIZED (
 SELECT s.*,bool_or(gf.is_serif AND f.role='h1') h1_serif,bool_or(gf.is_mono) mono
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id=l.id OR s.run_id=l.prev_id
 CROSS JOIN LATERAL (VALUES ('h1',lower(s.type#>>'{rendered,h1,family}')),('body',lower(s.type#>>'{rendered,body,family}'))) f(role,family)
 LEFT JOIN gf ON gf.family=f.family WHERE s.ok GROUP BY s.run_id,s.domain
), base AS (
 SELECT s.*,sc.scope FROM classified s CROSS JOIN(VALUES('all'::text),('en'::text))sc(scope)
 WHERE sc.scope='all' OR s.lang ILIKE 'en%'
), signals AS (
 SELECT b.run_id,b.index_name,b.scope,d.signal,d.label,coalesce(d.hit,false) hit FROM base b
 CROSS JOIN LATERAL(VALUES
 ('dark_theme','Dark theme',color->>'theme'='dark'),
 ('high_whitespace','Whitespace ≥ 60%',(composition->>'whitespace_ratio')::numeric>=0.6),
 ('tight_tracking','Tight headline tracking',(type#>>'{declared,h1,letter_spacing_em}')::numeric< -0.02),
 ('big_headline','Headline ≥ 48px',(type#>>'{declared,h1,size_px}')::numeric>=48),
 ('pill_cta','Pill buttons',(layout->>'cta_radius_px')::numeric=999),
 ('webgl_hero','WebGL / 3D hero',layout->>'hero_media'='webgl'),
 ('video_hero','Video hero',layout->>'hero_media'='video'),
 ('centered_headline','Centered headline',layout->>'h1_align'='center'),
 ('serif_headline','Serif headline',coalesce(type#>>'{rendered,h1,family}','') !~* 'sans' AND (coalesce(b.h1_serif,false) OR type#>>'{rendered,h1,family}' ~* 'serif|times|georgia|garamond|caslon|tiempos|fraunces|newsreader|playfair|editorial')),
 ('mono_anywhere','Monospace in use',coalesce(b.mono,false) OR concat(type#>>'{rendered,h1,family}',' ',type#>>'{rendered,body,family}') ~* 'mono|code|courier'),
 ('system_font','System UI body text',type#>>'{rendered,body,family}'='System UI'),
 ('tailwind','Tailwind',tech->'tailwind'='true'::jsonb))d(signal,label,hit)
), shares AS (
 SELECT run_id,scope,signal,label,avg(hit::integer::numeric) FILTER(WHERE index_name='vanguard') v,avg(hit::integer::numeric) FILTER(WHERE index_name='mainstream') m
 FROM signals GROUP BY run_id,scope,signal,label
)
SELECT n.scope,n.signal,n.label,n.v vanguard_share,n.m mainstream_share,round((n.v-n.m)*100,1) spread_pts,round((p.v-p.m)*100,1) prev_spread_pts
FROM shares n JOIN public.crawl_latest l ON n.run_id=l.id LEFT JOIN shares p ON p.run_id=l.prev_id AND p.scope=n.scope AND p.signal=n.signal;
CREATE MATERIALIZED VIEW public.crawl_font_share_mat AS SELECT * FROM public.crawl_font_share_live;
CREATE UNIQUE INDEX crawl_font_share_mat_key ON public.crawl_font_share_mat(run_id,scope,index_name,role,family);
CREATE MATERIALIZED VIEW public.crawl_color_stats_mat AS SELECT * FROM public.crawl_color_stats_live;
CREATE UNIQUE INDEX crawl_color_stats_mat_key ON public.crawl_color_stats_mat(run_id,scope,index_name);
CREATE MATERIALIZED VIEW public.crawl_layout_share_mat AS SELECT * FROM public.crawl_layout_share_live;
CREATE UNIQUE INDEX crawl_layout_share_mat_key ON public.crawl_layout_share_mat(run_id,scope,index_name,dimension,value);
CREATE MATERIALIZED VIEW public.crawl_tech_share_mat AS SELECT * FROM public.crawl_tech_share_live;
CREATE UNIQUE INDEX crawl_tech_share_mat_key ON public.crawl_tech_share_mat(run_id,scope,index_name,tech);
CREATE MATERIALIZED VIEW public.crawl_cta_phrases_mat AS SELECT * FROM public.crawl_cta_phrases_live;
CREATE UNIQUE INDEX crawl_cta_phrases_mat_key ON public.crawl_cta_phrases_mat(run_id,scope,index_name,phrase);
CREATE MATERIALIZED VIEW public.crawl_h1_words_mat AS SELECT * FROM public.crawl_h1_words_live;
CREATE UNIQUE INDEX crawl_h1_words_mat_key ON public.crawl_h1_words_mat(run_id,scope,index_name,word);
CREATE MATERIALIZED VIEW public.crawl_spread_mat AS SELECT * FROM public.crawl_spread_live;
CREATE UNIQUE INDEX crawl_spread_mat_key ON public.crawl_spread_mat(scope,signal);
REVOKE ALL ON public.crawl_font_share_live,public.crawl_font_share_mat,public.crawl_color_stats_live,public.crawl_color_stats_mat,public.crawl_layout_share_live,public.crawl_layout_share_mat,public.crawl_tech_share_live,public.crawl_tech_share_mat,public.crawl_cta_phrases_live,public.crawl_cta_phrases_mat,public.crawl_h1_words_live,public.crawl_h1_words_mat,public.crawl_spread_live,public.crawl_spread_mat FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crawl_font_share_live,public.crawl_font_share_mat,public.crawl_color_stats_live,public.crawl_color_stats_mat,public.crawl_layout_share_live,public.crawl_layout_share_mat,public.crawl_tech_share_live,public.crawl_tech_share_mat,public.crawl_cta_phrases_live,public.crawl_cta_phrases_mat,public.crawl_h1_words_live,public.crawl_h1_words_mat,public.crawl_spread_live,public.crawl_spread_mat TO service_role;
-- Owner-rights facades are intentional: the underlying objects remain inaccessible to visitors.
CREATE VIEW public.crawl_font_share WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_font_share_mat;
CREATE VIEW public.crawl_color_stats WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_color_stats_mat;
CREATE VIEW public.crawl_layout_share WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_layout_share_mat;
CREATE VIEW public.crawl_tech_share WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_tech_share_mat;
CREATE VIEW public.crawl_cta_phrases WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_cta_phrases_mat;
CREATE VIEW public.crawl_h1_words WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_h1_words_mat;
CREATE VIEW public.crawl_spread WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_spread_mat;
GRANT SELECT ON public.crawl_font_share,public.crawl_color_stats,public.crawl_layout_share,public.crawl_tech_share,public.crawl_cta_phrases,public.crawl_h1_words,public.crawl_spread TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.refresh_crawl_aggregates() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
BEGIN
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_font_share_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_color_stats_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_layout_share_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_tech_share_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_cta_phrases_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_h1_words_mat;
 REFRESH MATERIALIZED VIEW CONCURRENTLY public.crawl_spread_mat;
END;
$function$;
REVOKE ALL ON FUNCTION public.refresh_crawl_aggregates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_crawl_aggregates() TO service_role;
SELECT public.refresh_crawl_aggregates();