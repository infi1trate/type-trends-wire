# V3 · user-facing strings changed outside story bodies

Old → new, file. Code names, file names and addresses (`/terminal?panel=library`, `?tab=moves`, `tape.ts`, `front-tape`) are unchanged.

| Old | New | File |
|---|---|---|
| The tape (Today's section title) | Latest changes | src/lib/front/tape-block.ts |
| The whole tape → | All changes → | src/components/read/FrontView.tsx |
| THE TAPE (Terminal Library band) | LATEST CHANGES | src/components/terminal/Library.tsx |
| The tape (glossary entry title) | Latest changes | src/lib/glossary.ts |
| The tape (Digest "Keep reading" link) | Latest changes | src/lib/digest/edition.ts |
| "…the tape of every confirmed change…" (Today's description) | "…the latest confirmed changes…" | src/routes/index.tsx |
| "…the tape of confirmed changes…" (Today's purpose, Read tour) | "…the latest confirmed changes…" | src/lib/ia.ts, src/lib/tour.ts |
| "They stay on the tape." (retired story page) | "They stay in the latest changes." | src/components/read/StoryView.tsx |
| "…is not on the tape…" / "…stay off the tape…" (glossary, retired page, rule texts) | "…in / out of the latest changes…" | src/lib/glossary.ts, src/components/read/StoryView.tsx |
| Rule texts on method pages: "go to the tape only", "stays on the tape", "a tape line", "Tape, stories, studies", "Tape line:" | "go to the latest changes only", "stays in the latest changes", "a line in the latest changes", "Latest changes, stories, studies", "Latest changes line:" | src/lib/brand-names.ts, carousel.ts, promo.ts, stories/rules.ts, stories/quiet.ts, stories/editor.ts, stories/types.ts, newsroom/register.ts, newsroom/wire-only.ts, newsroom/news.ts, newsroom/docs.ts |
| Retired-story notes stored as "…a tape line" / "…on the tape" | shown as "…a line in the latest changes" / "…in the latest changes" (stored reasons unchanged: rules match on them) | src/components/read/StoryView.tsx |
| Moved (sticker on brand tiles) | Changed | src/components/read/BrandsIndexView.tsx, src/lib/pop/rules.ts |
| Moved this week | Changed this week | src/components/read/BrandsIndexView.tsx |
| N move / N moves (brand cards) | N change / N changes | src/components/read/BrandsIndexView.tsx |
| Moves (Brands sort) | Changes | src/lib/brands-index.ts |
| Recent moves (Brands section label, audit section) | Recent changes | src/components/read/BrandsIndexView.tsx, src/components/agency/AuditView.tsx |
| Brands: recent moves (collection link) | Brands: recent changes | src/lib/collections/registry.ts |
| "N tracked brands." / "N of M tracked brands match …" | "N brands slug reads." / "N of M brands match …" | src/lib/brands-index.ts |
| "300 tracked brands in ten sectors: … every confirmed move and how each sits against its sector." | "300 brands slug reads in ten sectors: … every confirmed change and how each sits in its sector." | src/components/read/BrandsIndexView.tsx |
| Search the tracked brands | Search the brands | src/components/read/BrandsIndexView.tsx |
| "Every tracked brand: identity, confirmed moves and rebrands…" (Brands description) | "Every brand slug reads: identity, confirmed changes and rebrands…" | src/routes/brands.index.tsx |
| "Who is doing it: tracked brands, their identity and every confirmed move." | "Who is doing it: the brands slug reads, their identity and every confirmed change." | src/lib/ia.ts |
| "Turn signals and brand moves into a decision…" | "Turn signals and brand changes into a decision…" | src/components/read/ToolsViews.tsx |
| Tour: "…what moved since the last data…", "…every confirmed move…" | "…what changed since the last data…", "…every confirmed change…" | src/lib/tour.ts |
| Quiet day: "Quiet: no new story in the last 24 hours. Below is the rest of this week, then the same week from the archive, each with the date it happened." | "Nothing new today. The brands are behaving. Here is the rest of the week, and what was happening this same week in years past." | src/components/read/FrontView.tsx |
| Today's change lines: "Netlify · headline font, Figtree to Systemia; body font, Instrument Sans to Systemia · home page, about page" | "Netlify's homepage and about page now speak in one typeface, Systemia, where they used to use two: Figtree for headlines and Instrument Sans for text." (by rule; Terminal and data keep the terse form) | src/lib/tape-sentence.ts, src/lib/tape.ts, src/components/read/FrontView.tsx |

Not yet brought to the word list (left, see the report): "tracked homepages" inside stored fact lines, receipts and number lines (they are facts the stories cite), the 404 and library-not-found pages' "tracked brand" wording, signal and pattern page captions, the Data view, and every other empty state.
