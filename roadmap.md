# Phase E3 · The front page and the navigation

- [x] 0.1 Sale-mode census counts sale wording only (not seasonal); recount No. 90 as a correction
- [x] 0.2 Quotations show captured text unchanged (no currency rewrite inside quotes)
- [x] 0.3 Census "How we know" copy (newest capture + one ≥6 h older; sale: headline and buttons)
- [x] 1 Nav: Live→Today; bar Today, Signals, Brands, Patterns, (Studies?), Digest, More; More menu; narrow menu same order; old addresses
- [x] 2 Front: drop Page state; Also today cards; The tape block; Earlier this week minus today; Explore rules; Moving now hidden without comparison; narrow order
- [x] Tests, golden unchanged, TTFB before/after, 360/768/1024/1440 checks, report

# Phase E3b · Speed back + four touches
- [x] 1 No DB read before first byte on /, brand, story; front tape/counts/cards from stored read records; before/after TTFB
- [x] 2a Earlier this week: one heading with count
- [x] 2b Also today: no twin pictures (gathered story takes next unused member crop)
- [x] 2c Colour change with same plain names hidden on Read tape (front, brand); terminal keeps hex
- [x] 2d No. 90 deck correction (two captures at least six hours apart)
- [x] 3 Writer order after reset: lead, census pieces, rest by rank; reset time ET


# Phase E5 · The Digest: one argument a week
- [x] 0 /data lead study chart fits at 360/390 (value label inside padding)
- [x] 1 Issue model from published stories: cover choice (pure), five rows, three pictures, one chart, numbers line, keep reading, 600-word budget
- [x] 2 Digest writer (sheet, schema, checks, 2/day, digest_texts insert-only, fallback)
- [x] 3 No. 1 rebuilt; corrections names (pure); archive rows
- [x] 4 Terminal weekly brief: withdrawn line; brief generator input = published/integrity-passed only
- [x] 5 RSS, share image, meta, Editions row, Read bar, next-issue line, no-story week = no issue
- [x] Tests, responsive 360–1920, heights + TTFB before/after, report

# Phase U1 + U2 · One address per thing, two views; receipts in place
- [ ] 0 Story body set like a study opening (17/18 px, 68ch)
- [ ] 1 `?view=data` on story, brand, signal, pattern, study, week; dark shell; redirects from old addresses; toggleHref/modeOf; noindex + canonical; name line + Read view link; keys
- [ ] 2 Receipt drawer on Read pages (`?receipt=type:id`), pure receipt models, focus trap, Back/Esc, reduced motion
- [ ] 3 `storyForRow` and "No. N →" on data rows (one batched read per table)
- [ ] 4 One name per thing (ia.ts/labels.ts), one glossary, names test
- [x] Tests, responsive 360–1920, TTFB before/after, report

## U2b · DB load first, follow-ups, story truth fixes
- [x] A1 confirm no API caller of refresh_library_history()
- [x] A2 materialize library_site_history (same cols) + indexes, refresh in library_history_refresh_job, equality check, repoint callers
- [x] A3 read history once / keyset, not pages of 200
- [x] A4 cache forecasts / sector_stats / latest / tag_share (run-keyed), health_facts 60 s
- [x] A5 library_snapshots slow selects: EXPLAIN before/after, index or narrow
- [x] A6 EXPLAIN new object + three slowest remaining
- [x] B1 /stories/no/<n> keeps query string
- [x] B2 story page hydration #418
- [x] B3 drawer/Data view change rows: capture dates first, "confirmed <date>"
- [x] B4 pattern story links, one glossary test, 44 px check at 360/390, old links
- [x] C one count per claim (white space, breakout, against the grain), sheet dedupe, evidence from sheet, headline wording, rebuild records
- [x] D hexName fix + 20-hex tests, colour-word check

# U3 + U4 · One design system for both views; the terminal as a workbench
- [x] 0 Print footer path identical on server and client (decoded); check brand/signal/pattern/study/Digest
- [x] 1.1 One token source (system.ts): type steps, colour roles (Read + Data), space/shape, motion → CSS vars + typed mirror, test
- [x] 1.2 Adopt tokens in Read + terminal components; lint test (no raw hex / px font size in src/components)
- [x] 1.3 One chart kit (line by quarter, small multiples, bars, sparkline, before/after strip) with look read|data, tables, labels.ts formats; remove duplicates
- [x] 1.4 One navigation: seven sections from ia.ts (Studies added), F1–F7, Read keys 1–7 ? / `, Tools in bar ≥1024 if it fits
- [x] 1.5 /brand/system page (BRAND_PUBLIC)
- [x] 2.1 Study figure tables: "Open in console" with prefilled command; pure commands + tests; sector lens on Data view tables
- [x] 2.2 "Copy as CSV" on Data view + terminal tables
- [x] 2.3 Pitches: table (additive), editor-only Pitch form, desk Pitched list with engine verdicts, builder evaluates open pitches
- [x] Responsive 360–1920 both views, TTFB before/after, report

# Phase I3 · Truth fixes + lead pictures
- [x] 0.1 Re-read vs change (mark events 14 d), tape/counts/candidates ignore, Data view line, re-check stories, tag-intake reuse, 40-call noise measurement
- [x] 0.2 News name matching, news facts sheet, no-story when nothing to say, retire No. 77, re-check news stories
- [x] 0.3 Method words narrowed + tests; study No. 4 writer call; facts_hash rebuild check
- [x] 0.4 Why 81/82/91 had no text; queue by front position; no empty sections; no lead without text
- [x] 0.5 Grid 0 columns; percentage-as-price; mark existing rows
- [x] 1 leadPicture pure fn, rules + fallbacks, crop gate (stored), slots (front lead, cards, story page, Data Pictures table), sizes/eager/lazy, captions/alt
- [x] Tests, responsive, weight/paint before/after, report

# I3b · Five follow-ups after reading I3 live
- [x] 1 Front lead: picture-only right column ≥1024 (stat+trail left under Receipts), compact captions, heights before/after at 1440/1024/390
- [x] 2 ragged-edge.com → raggededge.com; inactive excluded everywhere (audit); intake answer; No. 45 rebuild + 1 writer call + correction; other users; health name-in-title check
- [x] 3 AI read variants investigation; read_version column + backfill; version mix for top-10 share / top-10 momentum AI signals
- [x] 4 Superlative check accepts ranked-list first/last claims + tests; Study No. 4 writer once
- [x] 5 Crop quality measured at intake/sweep; time per measurement
- [x] Tests, responsive 360–1920, report, commit

# W1b · Every surface a brand owns
- [x] 1 Icon/card change = measured change (perceptual diff, prev ≥2 captures, new ≥2 captures ≥6 h apart); tape pair; Data "Icon and card history"; verdicts for the 9 brands
- [x] 2 Brand page "Surfaces" block (home/product/about/pricing first screens + icon + card); Data "Surfaces" table with Matches home; weights/heights before/after
- [x] 3 Product vs home match (headline typeface + accent, same crawl); brand-page line; census candidate commerce/hardware; N/M + brands
- [x] 4 `quiet` story type (icon/card or same-url non-home identity change, no wire mention ±14 d); wording ban; leadPicture pair; today's candidates
- [x] 5 Corrected story with hidden text first in writer queue + test; facts-built body without run numbers, lower-case stages; show No. 45 body
- [ ] 6 Study No. 4 writer once; outcome — waiting: today's study allowance (4/4) was used before this build; run `bun scripts/w1b-study4.ts` once after the 7 pm ET reset
- [ ] Tests, responsive, report, commit

# W1c · Three changes to W1b
- [x] 1 A page that follows its homepage (same kind, confirmed, ±30 days; icons/cards vs any identity change or rebrand) is not quiet; fact on the brand's own story (candidate + fold onto stored published/held story); today's candidates re-reported
- [x] 2 Outlets = publications on the wire's source list only (RSS feeds); social and aggregators searched, never counted or named; N and list reported
- [x] 3 Surfaces: compact rows (home/product/about/pricing/changelog), match line, ≤240 px at 1440 and ≤420 px at 390; crop intake accepts product/about/pricing_page first screens (own table, same rules); thumbnails from fixtures
- [x] Tests, responsive 360–1920, report, commit

# Phase N1 · Newsroom foundations (no reader-facing change)
- [x] 1 newsroom/ style.md (rules + examples + banned lists), beats.md, README.md; style-vs-code test
- [x] 1 desk log (append-only) + history view with story_edits; board = pitches + assignments/status
- [x] 2 story state history (8 states), pipeline writes, 14-day backfill
- [x] 3 action register with levels; actor required; preview = proposal; owner + phrase; every call logged; memory action (<200 KB); wire-only switch (off); docs/editor-desk.md
- [x] 4 spend ledger (model from ai_usage, build credits via desk), weekly cap (not set), cap stops writers/costly actions/health/log; ET Mon–Sun; this week's spend report
- [x] 5 golden counts; writing set fixtures; scorer + suite; hand-run live script (refuses when allowance used, not run); version stamps + score files test; README rule
- [x] 6 /desk: queue with state history, desk log with desk filter, spend vs cap, register, golden scores; responsive 7 widths
- [x] Tests, report, commit

# Phase W1d · Quiet-change fixes
- [x] 1 quiet change needs icon/card/typeface + picture; accent/palette/theme alone stays tape; retire No. 92; beats.md + tests
- [x] 2 colour-name boundaries vs 48-colour reference table; renamed colours on published stories listed
- [x] 3 How we know gives both capture dates (facts-built line + writers' sheet); deck/line agreement test
- [x] 4 no empty "The numbers" line; fallback list from stored lines or section left out; story types audited

# Phase N2 · Standards, editor in chief, copy desk
- [x] 1 order of work: engine-run stories wait held for review; published only from reviewed; desk failure/cap falls back with reason; health counts it
- [x] 2 standards: eight-item checklist (no model) + second reader (one call, fixed structure, versioned); release by editor in chief/owner only
- [x] 3 editor in chief: one placement call when there is a choice; enforced after the call; holds only; two-day reoffer rule; versioned
- [x] 4 copy desk lints on every non-written line; No. 45 line fixed; weekly sweep logs; style.md from code
- [x] 5 hold + note actions; proposals list with owner status; truthful writer meter; No. 85 page-follow fact; /desk review details
- [x] 6 fixture runs (16 calls): standards 10 + 3 after one tuning, editor in chief 3 days
- [x] Tests, report, commit
