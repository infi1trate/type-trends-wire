CREATE TABLE public.crawl_runs (
 id text PRIMARY KEY, started_at timestamptz NOT NULL, finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','finished','failed')),
 target_per_index integer, seeds_meta jsonb, stats jsonb
);
GRANT SELECT ON public.crawl_runs TO anon, authenticated;
GRANT ALL ON public.crawl_runs TO service_role;
ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.crawl_runs FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.crawl_sites (
 run_id text NOT NULL REFERENCES public.crawl_runs(id) ON DELETE CASCADE,
 domain text NOT NULL, index_name text NOT NULL CHECK (index_name IN ('mainstream','vanguard')),
 crawled_at timestamptz NOT NULL, ok boolean NOT NULL, error text, final_url text, title text, lang text,
 type jsonb, color jsonb, layout jsonb, composition jsonb, lexicon jsonb, tech jsonb,
 PRIMARY KEY (run_id, domain)
);
GRANT SELECT ON public.crawl_sites TO anon, authenticated;
GRANT ALL ON public.crawl_sites TO service_role;
ALTER TABLE public.crawl_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read ok" ON public.crawl_sites FOR SELECT TO anon, authenticated USING (ok = true);
CREATE INDEX crawl_sites_run_idx ON public.crawl_sites (run_id, index_name, ok);
CREATE TABLE public.crawl_secrets (id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1), secret_sha256 text NOT NULL);
GRANT ALL ON public.crawl_secrets TO service_role;
ALTER TABLE public.crawl_secrets ENABLE ROW LEVEL SECURITY;

CREATE VIEW public.crawl_latest WITH (security_invoker = true) AS
 SELECT id, prev_id FROM (
 SELECT id, lead(id) OVER (ORDER BY finished_at DESC NULLS LAST, started_at DESC, id DESC) AS prev_id,
 row_number() OVER (ORDER BY finished_at DESC NULLS LAST, started_at DESC, id DESC) AS position
 FROM public.crawl_runs WHERE status = 'finished'
 ) ordered WHERE position = 1;
GRANT SELECT ON public.crawl_latest TO anon, authenticated, service_role;

CREATE VIEW public.crawl_font_share WITH (security_invoker = true) AS
 WITH base AS (
 SELECT s.*, count(*) OVER (PARTITION BY s.run_id, s.index_name) AS total
 FROM public.crawl_sites s JOIN public.crawl_runs r ON r.id = s.run_id
 WHERE s.ok AND r.status = 'finished'
 ), fonts AS (
 SELECT b.run_id, b.index_name, b.domain, b.total, f.role, nullif(trim(f.family), '') AS family
 FROM base b CROSS JOIN LATERAL (VALUES
 ('h1', b.type #>> '{rendered,h1,family}'), ('body', b.type #>> '{rendered,body,family}')
 ) f(role, family)
 )
 SELECT run_id, index_name, role, family, count(DISTINCT domain) AS sites,
 count(DISTINCT domain)::numeric / max(total) AS share
 FROM fonts WHERE family IS NOT NULL GROUP BY run_id, index_name, role, family;
GRANT SELECT ON public.crawl_font_share TO anon, authenticated, service_role;

CREATE VIEW public.crawl_color_stats WITH (security_invoker = true) AS
 WITH base AS (
 SELECT s.*,
 CASE WHEN jsonb_typeof(color->'whitespace_ratio') = 'number' THEN (color->>'whitespace_ratio')::numeric END AS whitespace,
 CASE WHEN jsonb_typeof(color->'body_contrast') = 'number' THEN (color->>'body_contrast')::numeric END AS contrast
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id = l.id WHERE s.ok
 ), channels AS (
 SELECT run_id, index_name,
 CASE WHEN color->>'accent' ~ '^#[0-9a-fA-F]{6}$' THEN substring(color->>'accent' FROM 2)
 WHEN color->>'accent' ~ '^#[0-9a-fA-F]{3}$' THEN
 repeat(substring(color->>'accent' FROM 2 FOR 1),2) || repeat(substring(color->>'accent' FROM 3 FOR 1),2) || repeat(substring(color->>'accent' FROM 4 FOR 1),2) END AS hex
 FROM base
 ), buckets AS (
 SELECT run_id, index_name, '#' ||
 lpad(to_hex(least(255, round(get_byte(decode(hex,'hex'),0)::numeric / 16)::integer * 16)),2,'0') ||
 lpad(to_hex(least(255, round(get_byte(decode(hex,'hex'),1)::numeric / 16)::integer * 16)),2,'0') ||
 lpad(to_hex(least(255, round(get_byte(decode(hex,'hex'),2)::numeric / 16)::integer * 16)),2,'0') AS hex
 FROM channels WHERE hex IS NOT NULL
 ), counts AS (
 SELECT run_id, index_name, hex, count(*) AS sites FROM buckets GROUP BY run_id,index_name,hex
 ), ranked AS (
 SELECT *, row_number() OVER (PARTITION BY run_id,index_name ORDER BY sites DESC,hex) AS position FROM counts
 ), accents AS (
 SELECT run_id,index_name,jsonb_agg(jsonb_build_object('hex',hex,'count',sites) ORDER BY sites DESC,hex) AS accent_top
 FROM ranked WHERE position <= 12 GROUP BY run_id,index_name
 )
 SELECT b.run_id,b.index_name,
 count(*) FILTER (WHERE b.color->>'theme' = 'dark')::numeric / count(*) AS dark_share,
 avg(b.whitespace) AS avg_whitespace,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY b.contrast::double precision) AS median_body_contrast,
 coalesce(a.accent_top,'[]'::jsonb) AS accent_top
 FROM base b LEFT JOIN accents a USING (run_id,index_name)
 GROUP BY b.run_id,b.index_name,a.accent_top;
GRANT SELECT ON public.crawl_color_stats TO anon, authenticated, service_role;

CREATE VIEW public.crawl_layout_share WITH (security_invoker = true) AS
 WITH base AS (
 SELECT s.*, count(*) OVER (PARTITION BY s.run_id,s.index_name) AS total,
 CASE WHEN jsonb_typeof(layout->'cta_radius_px') = 'number' THEN (layout->>'cta_radius_px')::numeric END AS radius,
 CASE WHEN jsonb_typeof(layout->'grid_max_cols') = 'number' THEN (layout->>'grid_max_cols')::numeric END AS cols,
 CASE WHEN jsonb_typeof(type #> '{declared,h1,size_px}') = 'number' THEN (type #>> '{declared,h1,size_px}')::numeric END AS size,
 CASE WHEN jsonb_typeof(type #> '{declared,h1,letter_spacing_em}') = 'number' THEN (type #>> '{declared,h1,letter_spacing_em}')::numeric END AS tracking
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id = l.id WHERE s.ok
 ), dimensions AS (
 SELECT b.run_id,b.index_name,b.domain,b.total,d.dimension,d.value
 FROM base b CROSS JOIN LATERAL (VALUES
 ('h1_align', b.layout->>'h1_align'),
 ('hero_media', b.layout->>'hero_media'),
 ('cta_shape', CASE WHEN radius IS NULL THEN 'none' WHEN radius <= 2 THEN 'sharp' WHEN radius <= 12 THEN 'soft' WHEN radius < 999 THEN 'round' ELSE 'pill' END),
 ('grid_cols', CASE WHEN cols IS NULL THEN NULL WHEN cols >= 5 THEN '5+' ELSE cols::integer::text END),
 ('h1_size', CASE WHEN size IS NULL THEN NULL WHEN size < 32 THEN '<32' WHEN size < 48 THEN '32–47' WHEN size < 64 THEN '48–63' WHEN size < 96 THEN '64–95' ELSE '96+' END),
 ('h1_tracking', CASE WHEN tracking IS NULL THEN NULL WHEN tracking < -0.02 THEN 'tight' WHEN tracking <= 0.02 THEN 'normal' ELSE 'wide' END),
 ('h1_case', CASE WHEN b.type #>> '{declared,h1,transform}' = 'uppercase' THEN 'uppercase' ELSE 'other' END)
 ) d(dimension,value)
 )
 SELECT run_id,index_name,dimension,value,count(DISTINCT domain) AS sites,
 count(DISTINCT domain)::numeric / max(total) AS share
 FROM dimensions WHERE value IS NOT NULL GROUP BY run_id,index_name,dimension,value;
GRANT SELECT ON public.crawl_layout_share TO anon, authenticated, service_role;

CREATE VIEW public.crawl_tech_share WITH (security_invoker = true) AS
 WITH base AS (
 SELECT s.*,count(*) OVER (PARTITION BY s.run_id,s.index_name) AS total
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id = l.id WHERE s.ok
 )
 SELECT b.run_id,b.index_name,t.key AS tech,count(DISTINCT b.domain) AS sites,
 count(DISTINCT b.domain)::numeric / max(b.total) AS share
 FROM base b CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(b.tech) = 'object' THEN b.tech ELSE '{}'::jsonb END) t
 WHERE t.value = 'true'::jsonb AND t.key IN ('next','nuxt','framer','webflow','wordpress','shopify','squarespace','wix','astro','gatsby','sveltekit','tailwind','gsap','lenis','three','lottie','webgl_canvas')
 GROUP BY b.run_id,b.index_name,t.key;
GRANT SELECT ON public.crawl_tech_share TO anon, authenticated, service_role;

CREATE VIEW public.crawl_cta_phrases WITH (security_invoker = true) AS
 WITH base AS (
 SELECT s.*,count(*) OVER (PARTITION BY s.run_id,s.index_name) AS total
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id = l.id WHERE s.ok
 ), phrases AS (
 SELECT b.run_id,b.index_name,b.domain,b.total,lower(trim(p.value #>> '{}')) AS phrase
 FROM base b CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.lexicon->'ctas') = 'array' THEN b.lexicon->'ctas' ELSE '[]'::jsonb END) p(value)
 WHERE jsonb_typeof(p.value) = 'string'
 ), counts AS (
 SELECT run_id,index_name,phrase,count(DISTINCT domain) AS sites,count(DISTINCT domain)::numeric / max(total) AS share
 FROM phrases WHERE phrase <> '' GROUP BY run_id,index_name,phrase
 ), ranked AS (
 SELECT *,row_number() OVER (PARTITION BY run_id,index_name ORDER BY sites DESC,phrase) AS position FROM counts
 ) SELECT run_id,index_name,phrase,sites,share FROM ranked WHERE position <= 50;
GRANT SELECT ON public.crawl_cta_phrases TO anon, authenticated, service_role;

CREATE VIEW public.crawl_h1_words WITH (security_invoker = true) AS
 WITH words AS (
 SELECT s.run_id,s.index_name,s.domain,w.word
 FROM public.crawl_sites s JOIN public.crawl_latest l ON s.run_id = l.id
 CROSS JOIN LATERAL regexp_split_to_table(lower(coalesce(s.lexicon->>'h1','')), '[^a-z]+') w(word)
 WHERE s.ok
 ), counts AS (
 SELECT run_id,index_name,word,count(DISTINCT domain) AS sites
 FROM words WHERE length(word) >= 3 AND word <> ALL(ARRAY['the','and','for','are','but','not','you','your','yours','our','ours','their','they','them','this','that','these','those','with','from','into','onto','about','above','below','over','under','out','off','all','any','each','few','more','most','other','some','such','only','own','same','than','too','very','can','will','just','should','now','was','were','been','being','have','has','had','does','did','doing','its','his','her','hers','she','him','who','what','when','where','why','how','which','while','also','here','there','then','once','again','because','through','between','before','after'])
 GROUP BY run_id,index_name,word
 ), ranked AS (
 SELECT *,row_number() OVER (PARTITION BY run_id,index_name ORDER BY sites DESC,word) AS position FROM counts
 ) SELECT run_id,index_name,word,sites FROM ranked WHERE position <= 100;
GRANT SELECT ON public.crawl_h1_words TO anon, authenticated, service_role;