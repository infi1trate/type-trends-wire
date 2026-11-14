-- Phase 5: curated crawl index, curation lead, discourse counts, new wire sources and alerts.
ALTER TABLE public.crawl_sites DROP CONSTRAINT crawl_sites_index_name_check;
ALTER TABLE public.crawl_sites ADD CONSTRAINT crawl_sites_index_name_check CHECK (index_name IN ('mainstream','vanguard','curated'));
ALTER TABLE public.crawl_sites ADD COLUMN galleries text[];
ALTER TABLE public.crawl_sites ADD CONSTRAINT crawl_sites_galleries_check CHECK (galleries IS NULL OR (cardinality(galleries) <= 10 AND galleries <@ ARRAY['godly','landbook','awwwards','minimalgallery','onepagelove','cssda','saaslandingpage','arena','producthunt']::text[]));
COMMENT ON COLUMN public.crawl_sites.galleries IS 'Gallery slugs that surfaced a curated-index site (sample-bias receipt).';

-- Spread gains curated share and curation lead (curated − mainstream); the materialization is rebuilt with the new columns.
DROP VIEW public.crawl_spread;
DROP MATERIALIZED VIEW public.crawl_spread_mat;
CREATE OR REPLACE VIEW public.crawl_spread_live WITH(security_invoker=true) AS
WITH gf AS MATERIALIZED (
  SELECT lower(family) AS family, bool_or(category='serif') AS is_serif, bool_or(category='monospace') AS is_mono
  FROM public.gfont_snapshots WHERE captured_on=(SELECT max(captured_on) FROM public.gfont_snapshots) GROUP BY lower(family)
), classified AS MATERIALIZED (
  SELECT s.run_id,s.domain,s.index_name,s.crawled_at,s.ok,s.error,s.final_url,s.title,s.lang,s.type,s.color,s.layout,s.composition,s.lexicon,s.tech,
    bool_or(gf.is_serif AND f.role='h1') AS h1_serif, bool_or(gf.is_mono) AS mono
  FROM public.crawl_sites s
  JOIN public.crawl_latest l_1 ON s.run_id=l_1.id OR s.run_id=l_1.prev_id
  CROSS JOIN LATERAL (VALUES ('h1',lower(s.type #>> '{rendered,h1,family}')),('body',lower(s.type #>> '{rendered,body,family}'))) f(role,family)
  LEFT JOIN gf ON gf.family=f.family
  WHERE s.ok GROUP BY s.run_id,s.domain
), base AS (
  SELECT s.*, sc.scope FROM classified s CROSS JOIN (VALUES ('all'),('en')) sc(scope) WHERE sc.scope='all' OR s.lang ILIKE 'en%'
), signals AS (
  SELECT b.run_id,b.index_name,b.scope,d.signal,d.label,coalesce(d.hit,false) AS hit FROM base b
  CROSS JOIN LATERAL (VALUES
    ('dark_theme','Dark theme',(b.color->>'theme')='dark'),
    ('high_whitespace','Whitespace ≥ 60%',((b.composition->>'whitespace_ratio')::numeric>=0.6)),
    ('tight_tracking','Tight headline tracking',((b.type #>> '{declared,h1,letter_spacing_em}')::numeric < -0.02)),
    ('big_headline','Headline ≥ 48px',((b.type #>> '{declared,h1,size_px}')::numeric>=48)),
    ('pill_cta','Pill buttons',((b.layout->>'cta_radius_px')::numeric=999)),
    ('webgl_hero','WebGL / 3D hero',(b.layout->>'hero_media')='webgl'),
    ('video_hero','Video hero',(b.layout->>'hero_media')='video'),
    ('centered_headline','Centered headline',(b.layout->>'h1_align')='center'),
    ('serif_headline','Serif headline',(coalesce(b.type #>> '{rendered,h1,family}','') !~* 'sans' AND (coalesce(b.h1_serif,false) OR (b.type #>> '{rendered,h1,family}') ~* 'serif|times|georgia|garamond|caslon|tiempos|fraunces|newsreader|playfair|editorial'))),
    ('mono_anywhere','Monospace in use',(coalesce(b.mono,false) OR concat(b.type #>> '{rendered,h1,family}',' ',b.type #>> '{rendered,body,family}') ~* 'mono|code|courier')),
    ('system_font','System UI body text',(b.type #>> '{rendered,body,family}')='System UI'),
    ('tailwind','Tailwind',(b.tech->'tailwind')='true'::jsonb)
  ) d(signal,label,hit)
), shares AS (
  SELECT run_id,scope,signal,label,
    avg(hit::integer::numeric) FILTER (WHERE index_name='vanguard') AS v,
    avg(hit::integer::numeric) FILTER (WHERE index_name='mainstream') AS m,
    avg(hit::integer::numeric) FILTER (WHERE index_name='curated') AS c
  FROM signals GROUP BY run_id,scope,signal,label
)
SELECT n.scope,n.signal,n.label,n.v AS vanguard_share,n.m AS mainstream_share,
  round((n.v-n.m)*100,1) AS spread_pts, round((p.v-p.m)*100,1) AS prev_spread_pts,
  n.c AS curated_share, round((n.c-n.m)*100,1) AS curation_lead_pts, round((p.c-p.m)*100,1) AS prev_curation_lead_pts
FROM shares n JOIN public.crawl_latest l ON n.run_id=l.id
LEFT JOIN shares p ON p.run_id=l.prev_id AND p.scope=n.scope AND p.signal=n.signal;
CREATE MATERIALIZED VIEW public.crawl_spread_mat AS SELECT * FROM public.crawl_spread_live;
CREATE UNIQUE INDEX crawl_spread_mat_key ON public.crawl_spread_mat(scope,signal);
REVOKE ALL ON public.crawl_spread_live,public.crawl_spread_mat FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.crawl_spread_live,public.crawl_spread_mat TO service_role;
-- Owner-rights facade is intentional: the underlying objects remain inaccessible to visitors.
CREATE VIEW public.crawl_spread WITH(security_invoker=false,security_barrier=true) AS SELECT * FROM public.crawl_spread_mat;
GRANT SELECT ON public.crawl_spread TO anon,authenticated,service_role;

-- Wire: new source kinds, external link and alert dedupe key.
ALTER TABLE public.wire_items DROP CONSTRAINT wire_items_source_kind_check;
ALTER TABLE public.wire_items ADD CONSTRAINT wire_items_source_kind_check CHECK (source_kind IN ('rss','hn','bluesky','arena','producthunt','alert'));
ALTER TABLE public.wire_items ADD COLUMN link text CHECK (link IS NULL OR (link ~ '^https?://' AND char_length(link) <= 2048));
ALTER TABLE public.wire_items ADD COLUMN ref text CHECK (ref IS NULL OR char_length(ref) <= 200);
COMMENT ON COLUMN public.wire_items.link IS 'Public external link named by the item (post link, product website, Are.na source).';
COMMENT ON COLUMN public.wire_items.ref IS 'Alert trait key (dimension:value) used for 28-day dedupe.';
CREATE INDEX wire_items_kind_published_idx ON public.wire_items(source_kind,published_at DESC);
CREATE INDEX wire_items_alert_ref_idx ON public.wire_items(ref,published_at DESC) WHERE source_kind='alert';

-- Discourse: public aggregate counts per sampled window, term and source. Term '*' carries window totals.
CREATE TABLE public.discourse_counts(
  source text NOT NULL CHECK (source IN ('bluesky','rss','hn','arena','producthunt')),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  term text NOT NULL CHECK (char_length(term) BETWEEN 1 AND 100),
  n integer NOT NULL DEFAULT 0 CHECK (n >= 0),
  fatigue integer NOT NULL DEFAULT 0 CHECK (fatigue >= 0),
  sampled_posts integer NOT NULL DEFAULT 0 CHECK (sampled_posts >= 0),
  design_posts integer NOT NULL DEFAULT 0 CHECK (design_posts >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source,window_start,window_end,term),
  CHECK (window_end > window_start)
);
GRANT SELECT ON public.discourse_counts TO anon,authenticated;
GRANT ALL ON public.discourse_counts TO service_role;
ALTER TABLE public.discourse_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.discourse_counts FOR SELECT TO anon,authenticated USING (true);
CREATE INDEX discourse_counts_term_idx ON public.discourse_counts(term,window_start DESC);
CREATE INDEX discourse_counts_window_idx ON public.discourse_counts(window_start DESC);

CREATE OR REPLACE FUNCTION public.discourse_merge(p_rows jsonb, p_add boolean) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE written integer;
BEGIN
  INSERT INTO public.discourse_counts(source,window_start,window_end,term,n,fatigue,sampled_posts,design_posts)
  SELECT r.source,r.window_start,r.window_end,r.term,r.n,r.fatigue,r.sampled_posts,r.design_posts
  FROM jsonb_to_recordset(p_rows) AS r(source text,window_start timestamptz,window_end timestamptz,term text,n integer,fatigue integer,sampled_posts integer,design_posts integer)
  ON CONFLICT (source,window_start,window_end,term) DO UPDATE SET
    n = CASE WHEN p_add THEN public.discourse_counts.n + excluded.n ELSE excluded.n END,
    fatigue = CASE WHEN p_add THEN public.discourse_counts.fatigue + excluded.fatigue ELSE excluded.fatigue END,
    sampled_posts = CASE WHEN p_add THEN public.discourse_counts.sampled_posts + excluded.sampled_posts ELSE excluded.sampled_posts END,
    design_posts = CASE WHEN p_add THEN public.discourse_counts.design_posts + excluded.design_posts ELSE excluded.design_posts END,
    updated_at = now();
  GET DIAGNOSTICS written = ROW_COUNT;
  RETURN written;
END;
$function$;
REVOKE ALL ON FUNCTION public.discourse_merge(jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.discourse_merge(jsonb,boolean) TO service_role;

-- Private conditional-request state for polled sources (ETag / Last-Modified).
CREATE TABLE public.source_cursors(
  key text PRIMARY KEY CHECK (char_length(key) <= 300),
  etag text CHECK (etag IS NULL OR char_length(etag) <= 300),
  last_modified text CHECK (last_modified IS NULL OR char_length(last_modified) <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.source_cursors TO service_role;
ALTER TABLE public.source_cursors ENABLE ROW LEVEL SECURITY;

SELECT public.refresh_crawl_aggregates();