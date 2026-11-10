REVOKE ALL ON public.crawl_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crawl_secrets TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.crawl_runs, public.crawl_sites FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crawl_runs, public.crawl_sites TO anon, authenticated;
REVOKE ALL ON public.crawl_latest, public.crawl_font_share, public.crawl_color_stats, public.crawl_layout_share, public.crawl_tech_share, public.crawl_cta_phrases, public.crawl_h1_words FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crawl_latest, public.crawl_font_share, public.crawl_color_stats, public.crawl_layout_share, public.crawl_tech_share, public.crawl_cta_phrases, public.crawl_h1_words TO anon, authenticated, service_role;