# A1 + A2 · visual pass (25 November 2026)

A1 commit: `2251131`. A2 commit: see Git history for “A2: Tighten editorial type and token-based spacing”. Not deployed. `ICONS_SHOWN=true`, `MUSEUM_SHOWN=false`; no flags, routes, data, database, crawler, dependencies or font files changed.

## Changes
- Shared brand tiles: 20 / 28 / 32 / 48 / 56 / 72px; 1px ink border, paper background; 2px padding at small sizes and 6px at large sizes. Missing, failed and undersized icons use a neutral initial. All existing mark call sites use BrandMark; brand links on Explore, story related lists, signal showing lists and SiteCard gain initials without another data read.
- Largest supplied stored icon is preferred. This cannot retrieve touch icons that were never stored or included in the existing data response. Historical before/after icon evidence remains evidence, not identity decoration.
- Brand header and directory use 72px, 56px below 768; picture overlays 48px; Tape 32px and 52px minimum row; single-brand story row 28px; Terminal library 20px.
- Editorial row headlines use Newsreader 600; no new fonts. Read small text and row decks use 16px phone / 17px tablet and desktop.

## Token changes (old → new)
- `--sys-text-small-size` / `--tk-type-small-size`: 16px everywhere → 16px base / 17px ≥768.
- small leading: 1.45 → 1.4.
- reading/body leading: 1.55 → 1.4 (size stays 17px base / 18px ≥768, already above the requested floor).
- Read chip size: 12px → 12.5px. Read kicker stays 15px (already above floor); caption stays 14px; mono stays 13px.
- Terminal chip and caption: 11px → 12px; other Terminal type unchanged.
- New shared row role replaces the old 16px ledger title: 18px phone / 20px ≥768, leading 1.25, weight 600; Tape, Wire and rail reading rows use small text instead.
- Story-number figure: inherited 22/28px heading role → 14px phone / 16px ≥768.
- Read section gap: 3rem / 4rem (39 / 52px) → 3.1875rem / 4.25rem (41.4375 / 55.25px). Terminal stays 3rem / 4rem.
- Heading-to-row role: varying 8–19.5px → 16px on the targeted lists.
- Deck measure: 40ch → 62ch; balance instead of pretty (paragraphs stay pretty).
- Shared percentage sign: full-size → .55em on the figure role (56px and larger); smaller figures retain full-size signs. Count keeps its reserved width.
- New mark roles: sizes listed above, 2px/6px padding, 1px border, 52px Tape minimum. Brand header gap uses existing 16px space token.

## Living-design limits
The requested 56px is not on the allowed density ladder (3.5–4.5rem in .25rem steps, 13px root). Applied the nearest step, 4.25rem = 55.25px, and its coupled smaller-screen gap, 41.4375px instead of 40px. No limits or editions changed. The owner’s shipped edition is untouched.

## Tests
One final full run: **2,591 passed / 0 failed / 3 skipped**, 273 files. Build log: OK.
- Updated `pictures.test.tsx`: missing icons intentionally draw a fallback instead of nothing/spacer; obsolete size 16 becomes 20.
- Updated `slug.test.ts`: chip floor and body leading legitimately override kit defaults.
- Updated `living.test.ts`: includes the snapped Read gap alongside the unchanged Terminal gap.
- Added `brand-mark.test.ts`: two-thirds pixel threshold, both dimensions, SVG eligibility, largest supplied icon selection.
- No snapshots updated.

## Proof and limitations
72 small JPEGs: before/after × six pages × three widths × two views. `/data?view=data` has no separate Terminal index; those pictures show its existing Read page. Measurements are sandbox/dev observations, not release-gate performance proof. No page overflow was detected. Stored live content was used; no fixture or data write.

**Not ready for release-gate sign-off:** layout-shift non-regression is not established. Initial six-second observations had small Read increases on Today/Signals and a large transient Terminal Library increase at 768px; final pictures were refreshed after restoring the unchanged 15px kicker, with a shorter two-second observation and are not directly comparable. Existing study Data-view hydration errors occurred before and after; they are in the JSON observations and were left outside this visual-only pass. No reader/server loading changes were made to fix them.

The rhythm pass covers the shared lists and section helpers, not a verified audit of every nested heading. Arbitrary numeric cells in all tables were not rewritten; existing numeric classes and Signal figures are right-aligned/tabular. Study share PNG drawing and percentages inside chart/illustration artwork remain unchanged. These are remaining gaps, not claimed complete.

## Files changed
- `AGENTS.md`
- `roadmap.md`
- `src/components/brand/Motion.tsx`
- `src/components/data/DataIndexView.tsx`
- `src/components/digest/Editorial.tsx`
- `src/components/read/BrandMark.tsx`
- `src/components/read/BrandView.tsx`
- `src/components/read/BrandsIndexView.tsx`
- `src/components/read/FrontLive.tsx`
- `src/components/read/FrontView.tsx`
- `src/components/read/LeadPicture.tsx`
- `src/components/read/ObjectPage.tsx`
- `src/components/read/SignalView.tsx`
- `src/components/read/StoryCard.tsx`
- `src/components/read/StoryView.tsx`
- `src/components/read/brand-mark.test.ts`
- `src/components/read/pictures.test.tsx`
- `src/components/terminal/Library.tsx`
- `src/lib/living/living.test.ts`
- `src/lib/pictures.ts`
- `src/lib/theme/slug.test.ts`
- `src/lib/theme/slug.ts`
- `src/lib/theme/system.ts`
- `src/styles.css`
- `src/components/brand/FigureNumber.tsx`
- `docs/proof/a1a2/README.md`, 72 JPEGs, before/after measurement JSONs.
