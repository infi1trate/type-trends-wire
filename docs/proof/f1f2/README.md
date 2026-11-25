# F1 + F2 · saved progress

No deployment or AI calls. Museum remains off; icons remain on. No changes in `crawler/` or `.github/`.

## Completed
- J1b: union navigation labels with stored menu-button labels; retain historical counts, dated method line and quarter join; capped page strips end with `+N more sections`.
- F1 brand kit: palette hex/CSS/tokens JSON, measured type CSS/text, structure/asks, Google Fonts links only for known families, dated citation. Clipboard feedback lasts 1.2 seconds.
- F2 boards: `/boards` and `/boards/<key>`, 15-brand index floor, first-seen ordering, sector/category/sub-category/since filters, credited crops and report links, CSV and link copies, comparison selection and sortable Terminal table.
- F2 comparison: `/compare?a=&b=&c=`, aligned measured rows, palette shares, AI estimate labels, structure strips, equality markers, TSV/link/citation. Brand search and Brands-index checkboxes open the comparison.
- Stored kits for 300 brands. Request paths read these rows; the existing weekly forecast queue now carries a separate `designer-kit` step after `structure`, rather than adding its work to the structure step or wire ingest. No new cron job.

## Exact applied additive change
```sql
CREATE TABLE public.brand_kit_records (
  domain text PRIMARY KEY,
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.brand_kit_records TO anon, authenticated;
GRANT ALL ON public.brand_kit_records TO service_role;
ALTER TABLE public.brand_kit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.brand_kit_records FOR SELECT TO anon, authenticated USING (true);
```

Only stored public design fields enter this table. Crops are not stored in the kit; their reads and serving continue through existing visibility rules. Database verification counted 300 populated kits.

## Checks and proof
- J1b targeted checks: 31 passed. Brand clipboard checks: 11 passed.
- Board/schedule/route checks: 34 passed.
- Latest targeted regression run: 69 passed, 0 failed across ten files, including comparison, copies, board rules, voice inventory, density, theme and brand-page rendering.
- Full suite before the final registration/isolation repairs: 2,765 passed, 8 failed, 3 skipped. Seven failures belonged to new route registrations or fixture reads; the latest targeted run covers and passes those failures. The existing story-v2 score-file gate remains unresolved. The full suite was not rerun after those repairs; do not treat this as a release-gate pass.
- Latest preview build: OK.
- Real board filters and board-to-compare selection verified at 390/768/1440. Stripe-to-Linear search and Brands-index two-choice comparison verified end to end. Comparison has 11 aligned reading rows and no page-level horizontal overflow at those widths.
- A loaded Sentry card was inspected separately to verify the credited crop actually rendered; initial viewport captures can show lazy images before paint.
- Proof images here: brand take-away (with Copied), navigation join, board index, filtered look/structure boards, comparison, each at 390/768/1440.

## Not finished
- Part 2.2 collection aggregate tables/export row. Current stored collection membership is only preliminary; do not present it as an exact collection export.
- Part 2.3 missing Read chart/table footer actions.
- Part 5 Tools lead cards and brand-to-Tools quiet line.
- Dedicated real truncated-strip proof, collection/Tools proof, comprehensive keyboard/reduced-motion and layout-shift measurements.
- Three-brand phone layout and full Terminal comparison proof have not been verified.
- RSS omitted: existing watch feeds express confirmed changes/alerts, not a verified newly-adopting-trait feed.
- Hosted scheduled kit-step completion has not been observed; the initial refresh ran manually without model calls.

## Files
Core additions: `src/lib/take-away.ts`, `src/lib/designer-kit*.ts`, `src/lib/compare.ts`, their tests, shared Read copy/search/selection controls, Boards and Compare views/routes. Integrations: BrandView, BrandsIndexView, SignalView, Structure, GalleryView, Data views, query options, weekly steps, route/density/theme/voice registers. J1b also changes the structure derivation and shared line/sparkline join marker. Applied schema files and generated types are included. See the three prefixed commits for complete file lists.