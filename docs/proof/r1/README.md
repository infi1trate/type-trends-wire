# R1 · the category map (proof)

Not deployed. MUSEUM_SHOWN false, ICONS_SHOWN true. Nothing in crawler/ or .github/ (your 95281c4, 3829d46, c226710 are in history untouched).

## Migration (8a5ff5e, applied once, exactly these statements; BEGIN/COMMIT left to the tool)
```sql
ALTER TABLE public.library_sites
  ADD COLUMN category text,
  ADD COLUMN subcategory text;
CREATE INDEX library_sites_sector_category_subcategory_idx
  ON public.library_sites (sector, category, subcategory);
UPDATE public.library_sites AS site
SET category = mapped.category, subcategory = mapped.subcategory
FROM (VALUES
  -- 328 rows ('domain', 'category', 'subcategory'), listed in additive-migration.sql
) AS mapped(domain, category, subcategory)
WHERE site.domain = mapped.domain;
```
Rows filled: 328 of 328 (read query after the migration). No existing column, row value, policy or grant changed. No further database change in this turn.

## What readers see
- Brand page kicker: sector · category · sub-category, each a link (`brand-*.png`).
- /sectors/fintech: category chips with counts (12.5 px, existing chip style); `?category=payments` adds the sub-category chips and filters the list; `?sub=processing` alone finds its category. Headline signals stay sector-wide. Under 15 brands the list ends "Too few brands here to give a percentage yet." (`sector-*.png`).
- /brands?sector=fintech: chips and the sub-category line on cards (`brands-fintech-*.png`).
- Terminal brands list: Category and Sub-category columns, sortable, with filters once a sector is chosen (`terminal-library-*.png`).
Checked at 390, 768 and 1440: no sideways overflow on any of the six pages.

Fixed after looking: the chosen chip showed black on black; sector rows' marks drifted (centred under the sub-category line), now left-aligned with the line under the name; Terminal columns got fixed widths so domains and headings no longer break mid-word, and the width table is off below 1280 px where rows stack.

## Outputs and desks
- MCP `library_site` (site, similar brands) and `audit_sites` (glance) carry `category` and `subcategory` keys. There is no separate brand JSON route; MCP is that output.
- Scout: candidates must carry sector, category and sub-category from the tree; the code drops one without them, and the door refuses a brand `propose` without them ("A brand candidate needs its sector, category and sub-category from the category map. …"). Accepting stays the owner's. Scout prompt v2 recorded with one fixture call (10 kept, all classified; 3 dropped: two already tracked, one over the weekly ten) in `newsroom/scores/scout-v2.json`.
- Health `library` and the engineering health run's summary: on today's data, "300 brands: 30 in each of the ten sectors; 0 of 64 categories and 0 of 167 sub-categories hold at least 15 brands."

## Files changed this turn
src/lib/categories.ts, src/lib/categories.test.ts, src/components/read/SectorBrands.tsx, src/components/terminal/Library.tsx, src/styles.css, src/lib/mcp/tools/library-site.ts, src/lib/mcp/tools/audit-sites.ts, src/lib/newsroom/scout.ts, src/lib/newsroom/scout.server.ts, src/lib/stories/desk.ts, src/lib/stories/desk.server.ts, src/lib/health.ts, src/lib/health.server.ts, src/lib/newsroom/engineering.server.ts, src/lib/newsroom/golden/versions.ts, newsroom/scores/scout-v2.json, src/lib/newsroom/n4.test.ts, src/lib/newsroom/n5.test.ts.

## Tests
Added: chips, ?category=, ?sub= (with and without category), the 15-brand floor and line, JSON/MCP fields, library summary and line (categories.test.ts, 6 new); scout drop for missing/invalid levels (n5); door refusal and acceptance (n4).
Full run: 2,676 passed, 1 failed, 3 skipped. The one failure is V2's story-writer score file (needs the six frozen-story calls after 00:00 UTC), not R1.
