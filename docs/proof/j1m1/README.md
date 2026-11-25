# J1 + M1 · How pages are built, and how they behave on a phone

Not deployed. Flags unchanged (MUSEUM_SHOWN false, ICONS_SHOWN true). Nothing in crawler/ or .github/. No AI anywhere.

## Migration (applied as drizzle/migrations/0098_j1m1_structure_records.sql; exact statements in migration.sql)
Three new tables, nothing existing touched:
- `library_structure_records` (domain, viewport, quarter) — one record per brand, viewport and quarter; public read like library_snapshots.
- `library_structure_series` (signal, viewport, scope, quarter) — counts n_read / n_yes; public read.
- `library_structure_state` — the derivation bookmark; service role only (no policy).

## Counts (25 Nov 2026)
- Brands with a desktop reading: 283; with a phone reading: 279 (Q4 2026).
- Records stored: 2,590 desktop, 294 phone; navigation history filled for 22 desktop quarters (2020 Q4 – 2026 Q4; archives about twice a year).
- Structure signals registered: 36 (plus 22 navigation words and 4 sign-in wordings for /patterns/navigation).
- Signals passing the 15-brand floor library-wide in Q4 2026: 36 of 36 on at least one viewport.

## Where it runs
- Derivation: new `structure` step at the front of the weekly forecast's follow-ups (`jobs/steps.ts`), bookmark-resumed, 30 s budget. Not in the wire job or any request. One-time fill: `scripts/structure-backfill.ts`.
- Pages read stored rows only (`structure-read.server.ts`, 10-minute in-memory counts).

## Screenshots (1440 and 390)
brand-stripe (both viewports read), brand-none (Letterboxd, not read), signals-structure, signal-solutions (one structure signal), signal-search (desktop against phone), nav (/patterns/navigation), sector (fintech Structure group), terminal (optional columns on).

## Choices to know
- Desktop against phone uses the live Bars form: DotRange and Slope are still proposed forms that no reader page may import (forms.test). Say the word to accept one.
- Signals are registered in their own registry (`src/lib/structure.ts`) and rows on /signals?tab=structure; they are not in the weekly forecast, so no stage, Momentum or forecast yet.
- "Five years ago" and four-quarter change use the nearest well-covered quarter within two of the target, since archive copies come about twice a year.
- Top navigation = depth-1 visible items without logo/home links; under two such items reads as "not read".

## Files
New: src/lib/structure.ts, structure.server.ts, structure-read.server.ts, structure.test.ts, src/components/read/Structure.tsx, src/routes/patterns.navigation.tsx, scripts/structure-backfill.ts, docs/proof/j1m1/*.
Changed: jobs/steps.ts, jobs/steps.server.ts, forecast.server.ts, read.functions.ts, data.ts, ia.ts, labels-adjacent lists (voice.ts, glossary.ts, theme/route-mode.ts), BrandView.tsx, brands.$domain.tsx, signals.$key.tsx, SignalsIndexView.tsx, GalleryView.tsx, sectors.$sector.tsx, terminal/Library.tsx, dataview/Views.tsx, mcp/tools/library-site.ts, health.server.ts, newsroom/datadesk.server.ts; tests updated: steps, later, shell-first, forms, theme.

## Tests
Added src/lib/structure.test.ts (18 tests). Full run: 2,694 passed, 1 failed, 3 skipped; the one failure is the V2 story-writer score (newsroom/scores/story-v2.json), waiting since V2.
