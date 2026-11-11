REVOKE ALL ON public.library_sites,public.library_snapshots,public.library_events,public.library_latest,public.library_event_feed,public.library_sector_stats FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.library_sites,public.library_snapshots,public.library_events,public.library_latest,public.library_event_feed,public.library_sector_stats TO anon,authenticated;
REVOKE ALL ON SEQUENCE public.library_snapshots_id_seq,public.library_events_id_seq FROM PUBLIC,anon,authenticated;
ALTER FUNCTION public.library_snapshot_context(jsonb) VOLATILE;