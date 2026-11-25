# B2 · Three new chart forms (proposed, not in use)

All three are **proposed** forms in `src/lib/chart/forms.ts`. The rule that keeps proposed forms off reader pages (`forms.test.ts`) is unchanged.
They are drawn only on `/brand/system#b2`, on real stored rows. Three graphics-desk proposals were filed through the desk door (log 2128, 2129, 2130); accepting each is the owner's single action on the desk page.

## Files
New: `src/components/chartkit/AdoptionWake.tsx`, `wake-layout.ts`, `LeadLag.tsx`, `leadlag-layout.ts`, `PageAnatomy.tsx`, `anatomy-layout.ts`, `useChartWidth.ts`, `b2-layouts.test.ts`; `src/lib/leadlag.ts`, `leadlag.server.ts`, `chart/specimens-b2.ts`, `chart/specimens-b2.server.ts`; `scripts/leadlag-backfill.ts`, `scripts/b2-file-proposals.ts`; `drizzle/migrations/0099_b2_lead_lag_series.sql`.
Changed: `src/lib/chart/forms.ts` (+3 proposed forms, +3 shapes), `forms.test.ts` (expected proposed list), `src/components/brand/pages/SystemPage.tsx` (specimens + two held studies), `src/lib/data.ts`, `src/lib/read.functions.ts`, `src/lib/jobs/steps.server.ts` (lead-lag runs after the weekly structure step), `newsroom/beats.md` + README desks block (regenerated).

## Migration (applied)
See `migration.sql`: one new table `library_lead_lag_series` with public read, like `library_structure_series`. Filled once: 57 headline signals, 513 rows, vanguard of 31 brands.

## Pictures
`<form>-<width>.png` at rest and `<form>-<width>-hover.png` hovered (1440, 390); 768 at rest; `do-the-leaders-lead-*.png`, `how-a-homepage-is-built-*.png`.

## Not done
- Reader wiring: a reader page cannot import a proposed form, so signal pages, Study No. 2, sector/category pages and the brand page are unchanged. On acceptance, the form's status flips to live in a gated build and its import is added there.
- Embeds and share-card renderings for the three forms.
- The two held studies are on the kit page only (not in the study registry); their text has not gone through the study writer.

## Tests
`b2-layouts.test.ts`: 19 tests (dot/label overlap at 390/768/1440, axis years, censored column, readouts, lag incl. "at least" and "not yet", fills, band sums, typical page, 15-page floor).
Full run: 2,722 passed, 2 failed, 3 skipped; a second run's only failure was the V2 story-writer score that is still waiting.
