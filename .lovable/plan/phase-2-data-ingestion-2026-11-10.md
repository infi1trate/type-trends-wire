# Phase 2: data ingestion

Implement font and design-news ingestion without building phase 3 or changing the UI beyond TYPE SNAPSHOT.

## Implementation
- Use the existing Google Fonts connection credential `UDC_GOOGLE_FONTS_API_KEY` through its required gateway; do not request another key.
- Preserve the supplied feed list, HN queries, tagging, RSS/Atom parsing, seven-day window, snapshot ranking, 500-row batches, deduplication, and run receipts.
- Tighten public run visibility to `ok = true` and add TYPE SNAPSHOT from the latest successful font run.
- Run fonts daily at 06:17 UTC, wire every 15 minutes, and retention cleanup daily at 04:41 UTC (90-day wire / 30-day run retention).
- Run both ingestions immediately, inspect counts/latest dates/recent receipts, report feed failures, and verify the populated terminal.

## Required platform differences
This TanStack app cannot create new Supabase Edge Functions. Implement `/api/public/ingest-gfonts` and `/api/public/ingest-wire` using managed cron authentication instead. The existing cron credential removes the need for `app_config`, a generated database secret, or `dsgn_invoke`; managed HTTP scheduling tools configure the callbacks. Keep pruning as a SQL-only pg_cron job.

Wire runs 96 times/day to meet the requested 15-minute freshness, with recurring Cloud cost. Managed callbacks may arrive about 30 seconds after their scheduled minute. Limit provider concurrency to six for the hosted runtime. No changes to the single content route or terminal design.

## Verification
Add focused tests for tagging, parsing, design-story eligibility, seven-day inclusion, deduplication, ranking, and retention constants. Run them and existing band tests. Exercise protected callbacks, confirm unauthenticated calls cannot write, query persisted results, then open the Type Index and Wire with real data at desktop and mobile widths.