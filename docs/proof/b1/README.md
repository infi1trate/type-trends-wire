# B1 · Chart repair — partial implementation, not release-ready

## Delivered
- Shared pointer, touch and keyboard interaction, nearest-point rules, crosshair/markers, Escape clearing, live announcement and touch outside-clearing.
- Quarter figure constrained to its column; yearly ticks and measured/forecast endpoint values.
- Real adoption figure: 136 squares, 10 px each, four per quarter column; zero geometric overlaps at 390, 768 and 1440. Scrollable quarter strip and focus/step scrolling.
- Soft trail endpoint periods and first-value label; no line/style changes.
- Kit and named Terminal charts wired to shared feedback; before/after captures retain their existing controls.
- A1/A2 preserved. No dependencies, migration, crawler, flag or deployment changes.

## Tests and browser evidence
- Full suite: **2,601 passed / 0 failed / 3 skipped**, 275 files.
- Added `interaction.test.tsx`: nearest x, spatial square selection, keys, readout words/count/range, live announcement and editorial phone-coordinate bounds (6 tests).
- Added `adoption-layout.test.ts`: real 136-app fixture, three widths, disjoint contained cells and label-selection rules (4 tests).
- Updated `Charts.test.tsx`: one chart tab stop replaces individually tabbable marks; SVG retains description.
- Browser checked real signal/study/sector/Netlify/signal Data pages at 390/768/1440 with reduced motion; no horizontal document overflow. No captured runtime errors. Brand field readout confirmed after its deferred part arrived.
- Final touch check: signal readout persisted after tap, outside tap cleared; actual Terminal `/terminal?panel=brief&trait=css:starting_style` keyboard End announced Q4 2026 plus sector values.
- Proof JPEGs: `signal-390.jpg`, `signal-1440.jpg`, `study-390.jpg`, `study-1440.jpg`, `sector-390.jpg`, `sector-1440.jpg`. Measurements include an unsuccessful legacy `panel=forecast` selection; final Terminal check used `brief`.

## Unfinished / do not sign off
- Small sector readouts still obscure their chart/title and may require internal scrolling; the requirement to never cover the described point is not fully satisfied.
- Sector/some stretched sparklines have only value arrays in their current view model: their labels remain ordinal “Quarter N”, not actual calendar quarters. No data-read/model changes were introduced to invent dates.
- Named-mark adapters do not yet guarantee the requested structured period/series/count format for every specialised chart; full VibeMap/history/crawl interaction and phone-label collision audit remains.
- No complete pre-data height or layout-shift non-regression measurement was performed. Existing reservations were retained, but this is not proof that every chart meets the requirement.
- Shared movement and labelled chart geometry are tested; physical vertical touch scrolling and drag arbitration remain unverified beyond pan-y styling and tap/outside browser checks.
- The release gate must not treat this partial pass as finished B1.

## Files changed
- `AGENTS.md`
- `docs/proof/b1/README.md`
- `docs/proof/b1/adoption-real.json`
- `docs/proof/b1/measurements.json`
- `docs/proof/b1/sector-1440.jpg`
- `docs/proof/b1/sector-390.jpg`
- `docs/proof/b1/signal-1440.jpg`
- `docs/proof/b1/signal-390.jpg`
- `docs/proof/b1/study-1440.jpg`
- `docs/proof/b1/study-390.jpg`
- `roadmap.md`
- `src/components/brand/Illustration.tsx`
- `src/components/chartkit/Bars.tsx`
- `src/components/chartkit/BeforeAfter.tsx`
- `src/components/chartkit/Charts.test.tsx`
- `src/components/chartkit/DotRange.tsx`
- `src/components/chartkit/Frame.tsx`
- `src/components/chartkit/Interaction.tsx`
- `src/components/chartkit/Multiples.tsx`
- `src/components/chartkit/QuarterLine.tsx`
- `src/components/chartkit/Slope.tsx`
- `src/components/chartkit/Sparkline.tsx`
- `src/components/chartkit/adoption-layout.test.ts`
- `src/components/chartkit/adoption-layout.ts`
- `src/components/chartkit/interaction.test.tsx`
- `src/components/chartkit/interaction.ts`
- `src/components/data/Figures.tsx`
- `src/components/read/EditionsViews.tsx`
- `src/components/terminal/CrawlCharts.tsx`
- `src/components/terminal/LibraryHistory.tsx`
- `src/components/terminal/VibeMap.tsx`
- `src/lib/data-stories/embed.ts`
- `src/lib/theme/system.ts`
- `src/styles.css`
