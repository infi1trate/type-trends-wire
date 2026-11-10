ALTER POLICY "public read ok runs" ON public.ingest_runs USING (ok = true);
GRANT ALL ON public.gfont_snapshots, public.wire_items, public.ingest_runs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;