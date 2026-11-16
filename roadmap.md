# Phase 2
- [x] Add authenticated font and wire ingestion, preserving parsing and seven-day filtering.
- [x] Restrict public ingest logs to successful runs and add snapshot label.
- [x] Schedule daily fonts, 15-minute wire, and daily retention cleanup.
- [x] Run ingestion once and verify database results and live UI.

# Phase 3
- [x] Confirm public exposure consent for font snapshots and design news.
- [x] Add read-only MCP tools using the supported SDK and anonymous public-read policies, with analysis and round-trip tests.
- [x] Add footer MCP connection overlay.
- [x] Decode headline/excerpt entities, test, and backfill existing wire rows once.
- [x] Fill desktop panels to the footer with internal scrolling; preserve stacked mobile layout.
- [x] Verify the central MCP flow, report created paths, tests, and an Inter response; leave publishing to the user.

# Phase 4A
- [x] Add crawler tables and public-read aggregate views without changing existing tables.
- [x] Add secret-authenticated, size-bounded crawler reception and focused tests.
- [x] Verify tests, receiver responses and crawl_latest; leave secret setup and publishing to the user.

# Phase 4B
- [x] Add language-scoped aggregates and the Spread view.
- [x] Activate Color, Layout, Composition and Lexicon; add Spread and In the Wild.
- [x] Verify formatting, persistence, live data and desktop/mobile layouts; report without publishing.

# Phase 4C
- [x] Materialize seven crawler aggregates and optimize font classification joins, preserving public query contracts.
- [x] Refresh after finish and finished-run site reposts; test ordering and error handling.
- [x] Verify counts, permissions, query speed and live Spread; do not publish.

# Phase 5A
- [x] Add public library storage/views and private snapshot text; do not seed sites.
- [x] Extend crawler reception, add secret-authenticated state reads, and pure change detection.
- [x] Verify rules, existing crawler compatibility, permissions and endpoint behavior; report schemas without publishing.

# Phase 5B
- [x] Suppress baseline surface events and remove existing baseline noise.
- [x] Add F11 Library, site fingerprint/wireframes/history, and ticker events.
- [x] Add four public read-only MCP tools and library methodology.
- [x] Verify real sites, unknown-domain 404, responsive layouts, tests and MCP; do not publish.

# Phase 5A.2
- [x] Add private confirmed baselines and atomic two-capture confirmation.
- [x] Replay snapshots, replace noisy events and reset last-change dates.
- [x] Show safe unconfirmed changes under the timeline; keep headline plain.
- [x] Verify field rules, ingestion, real data and event counts; do not publish.

# Phase 5C
- [x] Add atomic AI spending reservations, private usage/jobs and public spend summary; test budget rules.
- [x] Add validated transient-image endpoint and repeat-hash reuse with eligible low-cost models.
- [x] Enqueue text extractions transactionally and add a bounded, durable, budget-guarded worker.
- [x] Add public trend aggregates and two-capture confirmation for tag/pricing changes.
- [x] Add AI-marked Library panels, detail blocks and read-only MCP trends.
- [x] Verify real pricing extraction (1,880 input / 486 output tokens), copy-only worker, 190 tests, protected endpoints, MCP and responsive displays; do not publish.
- [x] Enable vision under the owner's gateway-logging consent; one real in-memory JPEG through handleLibraryTag returned reused:false and stored tags for snapshot 2511 (1,704 input / 104 output tokens; $0.001164 estimated cost). Local fixture substituted only the unavailable crawler credential; production authentication unchanged. No publishing.
- [x] Harden image-only vision evidence, normalize blocked/low-confidence tags, exclude unreliable latest captures from trends/reuse/change detection and reject JPEG dimensions below 200×200; 199 tests passed. Remove orphaned synthetic baseline for deleted snapshot 2511.
- [x] Queue 251 latest eligible existing text captures once (102 pricing, 44 changelog, 105 product); retain 10/run and sequential concurrency because 25 sequential inferences are not proven to fit the existing four-minute lease. No publishing.
- [x] Accept four ordered section JPEGs, preserve legacy page fallback, calibrate vision confidence, and raise five-image reservation to $0.137288; 207 tests passed, including Gateway image ordering and actual-usage settlement.
- [x] Clear nine existing vision tags and nine AI-only confirmation baselines (including pending candidates); verify zero remain and preserve nine usage receipts. Measured baselines contained no AI fields. Report exact request shape without publishing.
- [x] Fix worker incremental claims, three-lane concurrency, 50-second claim cutoff/57-second inference cancellation for 60-second response budget, active-backfill cap 25, bounded paid text retries, and orphan reservation recovery.
- [ ] Set managed callback timeout to 90 seconds if supported; otherwise report the scheduling-tool limitation without replacing managed credentials.
- [x] Recover interrupted text jobs (18 by recovery time, two orphan receipts settled without refund) and existing validation failure; one real local worker processed 24/25 jobs in 26.3 seconds: done 3→27, pending 249→224, error 0→1. Vision uses direct crawler fetch, not pg_net; no explicit 60-second client timeout in source. No publishing.
# Phase 6A
- [x] Add source-isolated Wayback ingestion, tagging, state and historical confirmation.
- [x] Add public half-year signal/CSS/font/tag series and MCP history.
- [x] Add Library history charts, archive wireframe strip and year-grouped timeline.
- [x] Verify tests, public reads, endpoint contracts and responsive UI; do not publish.

# Phase 2A — quarterly archive history
- [x] Normalize next/font aliases, skip declared fallback families, replay archive domains and refresh history; verify live state stays unchanged and do not publish.
- [x] Add quarterly state, chronological per-domain archive replay and declared-font fallback; extend the existing backfill deadline.
- [x] Add quarterly public history, font ranks/redesign counts and MCP tools.
- [x] Add F12 History and quarterly site filmstrip without changing crawler code.
- [x] Verify replay, state/tag contracts, public reads, responsive UI and storage impact; do not publish.

# Phase 3 — forecast + weekly brief
- [x] Pure forecast model, leading indicators, backtest and brief validation with tests.
- [x] Forecast/trendsetter/brief storage, weekly Sunday schedule and one real run.
- [x] F10 FORECAST panel, Overview brief bar, MCP tools and methodology.
- [ ] 90-second callback timeout for the forecast schedule (managed scheduling tool cannot set it; same blocker as the extraction worker).
- [x] Phase 3 tweak: next-wave eligibility (share<35%, no none/image/*_none, ≥3 sites); rerun forecast + brief; no publish.

# Phase 4 — Taste Tools
- [x] Pure font catalog, scoring, era, color and command/query parsing with tests.
- [x] Weekly-refreshed usage/pairs/color/palette data and private cache/request/public-AI guards.
- [x] Four shared MCP/console tools, slash console, examples and methodology; limitations recorded in taste-tools-report.md.
- [x] One font-classification pass, six real runs, 298 tests, MCP extraction and responsive checks; no publishing.
- [ ] Hosted LITE address-pinning validation: waits on a published runtime; do not publish without owner instruction.
# Phase 4 follow-up
- [x] Proprietary/bespoke font classification; exclude from recommend_type (include_proprietary opt-in), differentiate and critique suggestions; min 2 sites per sector / 3 overall with fallback note.
- [x] Crawler-secret GET/POST /api/public/crawl-requests with attempts/retry and docs.
- [x] LITE fails closed on hosted workerd and still queues the URL; tests.
- [x] Refresh rerun and fintech-headline / pair reruns reported; no publishing.
- [x] Rendered crawl results: accept signals, rendered mode in critique/differentiate, 30-day re-queue, cache clearing on refresh and per URL.
# Phase 5 — signal breadth
- [x] MCP surfaces known tool errors (taste, LITE, budget, input) verbatim; unknown stay generic.
- [x] Curated index: payload/galleries, curation lead in spread, forecast `curation` component, third column in crawler UI.
- [x] Discourse: terms endpoint, ingest-wire items/mentions, discourse_counts, RSS/HN counting, forecast `discourse` + fatigue flag.
- [x] Are.na (6h) and Product Hunt (daily, dormant without token) sources; seed-candidates endpoint.
- [x] Supply component and flooding note; seven-component score with per-row coverage; backtest before/after.
- [x] Weekly wire alerts (≤10, 28-day trait dedupe), F8 source chips, MCP wire source_kind.
- [x] Methodology sections, tests, alert dry run; no publishing.
# Phase 5 — decisions
- [x] Are.na hard-off (AUP): schedule removed, adapter refuses, stored rows deleted, no seeds, methodology note.
- [x] Breakouts need share < 35% and stage not peaking/declining; alert dry run rerun.
- [x] Render-failure note: "Couldn't render this site (3 attempts)"; no automatic retry.
- [x] Godly removed from methodology gallery list (kept in enum).
- [ ] Product Hunt: stored PRODUCT_HUNT_TOKEN is rejected (401 invalid_oauth_token); waits on Brandon pasting the Developer Token.
# Phase 6A — showcase (terminal side)
- [x] F9 Rebrand Desk: identity-change log from confirmed live + archive events, before/after rows, forecast read, wire match, filters, MCP `rebrands`, methodology.
- [x] F7 Vibe Map: pure tag-vector PCA + k-means with named clusters, weekly `vibe_points` storage, scatter UI with keyboard, MCP `vibe_map`, methodology.
- [x] Chart of the Week: stored card per brief, /chart and /chart/$week pages, SVG + PNG (1200×675, 1080×1350), og:image, F10 block; generate current card.
- [x] Tests (PCA/k-means determinism, naming, rebrand rules, SVG snapshot, routes) and report; no publishing.
# Phase 7A — hardening
- [x] Provider layer (lovable | google) used by library, brief and taste calls; fail closed; per-provider prices; provider on ai_usage, brief and model card; tests.
- [x] Parity script (`bun scripts/ai-parity.ts`), dry; skips without GEMINI_API_KEY.
- [x] Run parity + models.list on Google (2026-11-16). Script has no pass threshold, so AI_PROVIDER stays lovable until Brandon decides.
- [x] GET /api/public/health + status-bar HEALTH line and job table; staleness/status/safety tests.
- [ ] Direct cron timeout check: platform blocks SQL reads of scheduler internals; health infers cut-offs instead. 90 s timeout fix stays with Brandon.
# Bugfix — weekly forecast
- [x] forecast-run body parsed as JSON (zod strict, any whitespace), 64 KB cap, auth first; tests.
- [x] Root cause: taste refresh read timed out (anonymous statement timeout) and failed the whole run; smaller JSON-path pages, memoized loops, taste/brief/vibe/chart non-fatal after the run is stored.
- [x] forecast_runs.error (≤300, sanitized) + health note; stale/missing crawl drops crawl components; tests.
- [x] Real weekly run with brief, alerts and chart card.

# Phase 8 — launch polish
- [x] Drop $ tickers: one label map (names + FONT/COLOR/LAYOUT/VIBE), alerts, chart cards, briefs, MCP label/dimension fields
- [x] (i) cards on panel and column headings from one glossary
- [x] Five stage word badges (Emerging, Rising, Peaking, Fading, Steady)
- [x] TODAY landing panel (key T, console `today`), F1 renamed SIGNALS (`ticker` alias kept)
- [x] First-visit tour (once, replayable via glossary and console `tour`)
- [x] Glossary (`?`, console `glossary`, footer link), deep links `#g-<id>`
- [x] Readable early and empty states, model-card coverage as sentences

# Phase 9 — The Digest
- [x] Routes /digest, /digest/$week, /digest/archive (+ not-found), issue No. 1 = 2026-W46; terminal footer link, key D, console `digest`
- [x] Pure issueModel(rows) with sections (masthead, cover, movers, specimens, palette, in the wild, rebrands, numbers, footer); historical rows per week
- [x] Thumbnails: site-thumbs bucket, site_thumbs + thumb_optouts tables, /api/public/ingest-thumbs, opt-out endpoint, typographic fallback, terminal site page thumb
- [x] Trait explainer pages /trait/$key + MCP explainer_url + terminal "Explainer →"
- [x] Editorial type system + 12-col grid + print stylesheet (Digest/trait only)
- [x] RSS /digest/rss.xml + OG images per issue and trait
- [x] Tests + report (ingest contract, opt-out how-to, fonts)

## Site password gate
- [x] Server-side gate, /unlock + /lock, throttle, robots/noindex, Lock links, tests

# Phase 10 — agency workflow
- [x] Watchlists table (capability ids, hashed edit token, feed token), server create/edit/rotate/delete with per-IP limit, render-queue offer
- [x] /watch/new, /watch/$id (week / 30 days, feed URL, rotate), local device list, WATCH panel (key W), console `watch …`, Add to watchlist on site pages + trait rows
- [x] Per-watchlist RSS /api/public/watch-feed/<token>.xml (open, in OPEN_PATHS with reason), weekly summary items
- [x] Competitive audit: pure auditModel, /audit, /audit/new, print, /audit.png (open), console `audit`, Compare with…, Audit these sites
- [x] MCP audit_sites + watchlist_changes, methodology lines
- [x] Tests + screenshots + report

# Phase 11 — proof and reach (Labs launch on hold: build/link nothing for it)
- [x] Step 0: run Google parity; switch AI_PROVIDER only if the script's pass threshold is met; run Product Hunt ingest once and report
- [x] Forecast ledger: append-only forecast_calls, one selection rule constant, pure resolution, first-call-stands, backfill, hit rate (<20 → sentence)
- [x] Ledger surfaces: /ledger (gated, editorial), terminal model card + console `ledger`, Digest Numbers hit rate at ≥20, trait explainer past calls, MCP forecast_ledger, methodology LEDGER
- [x] Embeds: /embed/trait/$key, /embed/chart/$week (open, frame-ancestors * only there, 404 card), Embed panel on trait + chart pages, oEmbed endpoint + link tags
- [x] MCP keys: mcp_keys + mcp_key_usage, Bearer dsgn_ keys raise limit, 401 for revoked/unknown, admin endpoint (crawler-secret auth), docs, MCP overlay "Using a key"
- [x] Tests + screenshots (/ledger, embed 320/800) + report

# Phase 12 — signal tiers and the so-what test (show narrow; nothing deleted; keep look)
- [x] tiers.ts (four questions, static sets + overrides with reasons) + fixture test
- [x] composites.ts (~12 combo:* signals in the site-traits layer; view gains h1 size column) + labels/basis
- [x] Momentum index + Confidence (pure, display only; seven components one click away)
- [x] MEASURED / AI ESTIMATE chip everywhere a value shows
- [x] Surfaces obey tiers (TODAY, SIGNALS, panels, Digest cover/movers, chart pick, alert candidates); All signals tier filter; so-what lines
- [x] MCP fields (tier, basis, momentum_index, confidence) + tier filter + methodology sections
- [x] /what-we-show page (gated) + links (glossary, terminal footer, Digest footer)
- [x] Dev forecast run (brief:false, alerts:"off", ledger:false) + tests + screenshots + report

# Phase 13 — one information architecture (structure only; reuse Digest type + terminal chrome)
- [x] ia.ts registry (six sections, SURFACES, tabs, key + panel aliases, mode toggle, legacy redirects) + no-orphan test
- [x] Four objects with one anatomy (ObjectPage): Signal /signals/$key (+ /trait redirect), Brand /brands/$domain, Story model (stories.ts + StoryCard/StoryRow), Pattern /patterns(/$key)
- [x] Read shell + Live front page (/), /signals, /brands, /patterns, /tools, /status; Digest/agency pages inside the shell
- [x] Terminal at /terminal: six section views with tabs, F1–F6, [ ] / ←→, old keys + panel ids as aliases, backtick mode toggle, `read` command
- [x] Sector lens (?sector=, remembered per device, scope fallback note)
- [x] Help: glossary entries, read-mode tour, MCP explainer_url → /signals + brand_url, embeds/oEmbed accept /signals, /what-we-show "Where things live"
- [x] Tests + screenshots + report

# Phase 14 — the story engine (structure + logic; keep type system and chrome)
- [x] stories/types.ts: 11 types, triggers, min evidence, templates, named thresholds
- [x] stories/score.ts: four 0–25 components, threshold, dedupe/merge, daily cap (24, 6 NEWS), held reasons, why-this-ran
- [x] Writing: deterministic headline/deck/facts with receipts; one validated AI "why it matters" line (≤10/day, ≤5/build, own budget label)
- [x] Storage: stories + story_edits (insert-only), edits overlay; build.server.ts hooked at end of wire/crawl/forecast jobs (20s budget, skip DEV); scripts/build-stories.ts 30-day backfill
- [x] Surfaces: /stories/$id (ObjectPage, ia.ts, backtick), Live lead/stream/type chips/lens, related stories on signal/brand/pattern, brand timeline links, Terminal Today held toggle, MCP `stories` (24 tools)
- [x] Editor's desk: /api/public/desk (crawler-secret Bearer, rate limited, story_edits only), /desk page (key in memory), docs/editor-desk.md
- [x] Tests + backfill + screenshots + report

# Phase 14b — make the story engine honest (small, surgical; don't publish)
- [x] MIN_RUN_GAP_DAYS gap rule for SHIFT, CROSSOVER, Moving now, TODAY and Digest movers; skip signals missing from the earlier run; honest empty states
- [x] FIRST SEEN: archive-measurable allowlist, sector rule (2 brands, archive ≥8 brands and ≥4 quarters)
- [x] scripts/retire-stories.ts: kill rows for rule breakers, correct rows for fixed wording; run once
- [x] Wording: crossover "<signal> reaches <sector>", layout moves in plain words, templated rebrand decks, new AI prompt + banned hedges
- [x] /status real-runs line; /what-we-show "What makes a story"
- [x] Tests, screenshots, report

# Phase 15 — the evidence layer, app side (don't publish)
- [x] `site_crops` table + private `site-crops` bucket; POST /api/public/ingest-crops; gated GET /crops/<path>; opt-out deletes crops; docs/crops.md
- [x] CropFigure, BeforeAfter, honest fallback; brand Sections strip + history, timeline before/after; story before/after + roundup grid; pattern section crops, counts, illustrated filter
- [x] Terminal brand record SECTIONS row; /status crop coverage line; /what-we-show "Images of other sites"
- [x] Reader-run guard (latest real run once newer than run 15); stage-change alert gap rule
- [x] Tests, zero-crop and fixture screenshots, report
- [ ] Contact address for "Report this image" (waiting on Brandon; link points at the removal policy until then)

# Phase 16 — rolling cadence, editions and packaging (app side; don't publish)
- [x] Vanguard list in /api/public/library-state (pure rule + tests)
- [x] 90-second scheduled callback: diagnose, bounded work per call, scripts/sql/phase16-cron.sql if cron must change
- [x] Freshness module; /status table; Read shell freshness line; Live "Updated" stamp
- [x] Morning Line (/morning, /morning/$date, archive, RSS, console `morning`)
- [x] Digest "The week in stories" (this week onward)
- [x] Sector reports (/sectors, /sectors/$sector, print)
- [x] Editions in ia.ts + /editions + terminal Digest tabs
- [x] MCP morning_line + sector_report (26 tools)
- [x] /welcome private landing (LANDING_PUBLIC = false), linked from /tools only
- [x] Watchlist feed run-to-run uses real runs + gap rule
- [x] Tests, screenshots, report

# Phase 17a — design-language groundwork + rename to "slug" (no visual change; don't publish)
- [x] Before screenshots (9 pages × 1440/360)
- [x] src/lib/brand.ts + Wordmark; rename user-facing DSGN/TERMINAL; MCP name slug + old-name alias; legacy-name test
- [x] src/lib/theme/ token contract, legacy theme (light/dark/vibes), blank stub + README; root mode attribute per route; fonts from theme
- [x] Move hard-coded colours/fonts/radii/shadows onto tokens
- [x] /kit (gated, Tools only, ia.ts) with all sections; consolidation list
- [x] <Treated> crop treatments
- [x] Chart primitives (scatter, line, bar, donut) + shared frame
- [x] Sector report Momentum once; freshness shell warns only on reader-facing jobs; /status crawler rhythms + lib-vanguard- runs
- [x] Tests, after screenshots + diff, report

# Phase 18a — the live front page (don't publish)
- [x] Pure front model + loader; page renders the model (masthead clock, ticker, lead, Moving now, live column, chart of the day, launches, your sector, editions, footer)
- [x] BUSY / STEADY / QUIET; QUIET archive fill labelled and dated; nothing restamped
- [x] /front.json (gated, ETag/304) + polling helper, new-stories control, since-your-last-visit marker
- [x] Formats mapping + front filter (?format=) + terminal Live tabs
- [x] story_numbers table + backfill (No. 1–48) + shown on front, story page, Morning Line, Digest, RSS, MCP; /stories/no/$number redirect
- [x] Small fixes: /tools tool count from registry; /terminal hydration (SSR query hand-off); StoryRow light mode; font-flow labels on dark
- [x] Tests, screenshots, report

# Phase 19a — data stories: framework, templates, first stories (don't publish)
- [x] Live column and terminal story list show "No. N" on every row
- [x] Registry, pure models, stepper (keys, buttons, scroll, ?step=, live region, reduced motion, no-JS sequence, print), ending block
- [x] Six views (adoption, before/after, multiples, field, drift, strip) + /kit examples
- [x] Four checks run on stored data: a, b, d live; c draft (5 of 8 quarters)
- [x] /data/where-you-sit (tracked brands only; untracked → audit)
- [x] Gated share image + one-step embed behind DATA_STORIES_PUBLIC = false; MCP data_stories (27 tools)
- [x] ia.ts, formats, front shelf; tests, screenshots, report
- [ ] Story c (fintech colour) — waits on more quarterly archive coverage (needs 8 well-covered quarters, has 5)

# Phase 17b-1 — the brand everywhere, part 1 (don't publish)
- [x] Before screenshots (front, story, signal, Digest, terminal, gate × 1440/360)
- [x] "slug" theme from brand/tokens (three modes), contract extended, default everywhere; legacy kept unregistered; one font link (Big Shoulders, Newsreader, IBM Plex Mono)
- [x] Contrast test; fonts-only-from-theme and removed-faces tests
- [x] Drawn mark (generated module + test), cuts by height, ground/slab rules, s monogram; favicon, apple-touch and app icon from the kit; gate, error pages, share images, feeds and embeds use the mark
- [x] Eight containers, page density in ia.ts, Ledger; tests (shadow tokens, one Plate, densities)
- [x] Chrome (slab header, live dot + UTC, Read/Terminal, freshness line, slab footer, slab ticker); front page composition A
- [x] Charts restyle (ink axes, dashed grid, Big Shoulders labels, gumballs, double-stroke lines)
- [x] Brand pages (/brand + 8) behind BRAND_PUBLIC = false; gated /brand/files downloads
- [x] Tests, after screenshots, report
- [x] Part 2: see Phase 17b-2

# Phase 17b-2 — the brand everywhere, part 2 (don't publish)
- [x] Live-review fixes: one-bar shell + Menu sheet, lead figure slot, gate mark fit + single focus ring, /brand deck once, legacy names at render, data-story highlights yellow/green, story frames fallback
- [x] Compositions per page type (story, signal, brand, pattern, Digest, Morning Line, sector report, data stories, tools/status)
- [x] Illustration: CutAndPaste, Trail, SoftObject from the kit filter file; limits + flat mode
- [x] Motion: arrive, press, cut, count, draw; reduced-motion end states
- [x] Share images + embeds in vibes with Big Shoulders / Newsreader atlases
- [x] Tests, screenshots, report
- [ ] Terminal: story lines, help text and the tour still set sentences in mono (README wants Newsreader); listed for Brandon, not changed

# Phase 20 — browse: brand page, pattern gallery + collections, signals index, audits and watchlists (don't publish)
- [x] Polish: data-story figures fill their column; sub-navs one scrolling row; Ledger number column (No. + 900 figure); gate field one ring at rest; terminal sentences in Newsreader + muted type labels; /what-we-show slugbot + DSGNTerminalBot
- [x] Brand page: identity card, moves timeline with before/after pairs, sector field + where-you-sit, similar brands (pure Jaccard), Raised actions
- [x] /brands index: Ledger, search, lens, sortable columns in URL
- [x] /patterns wall: tiles (crop or frame ≤60 boxes), filters in URL, count line, 48 per page + More + no-JS links, server-cached model
- [x] Collections registry (5), /collections + /collections/$slug, ia.ts, front Explore shelf, data-story links both ways
- [x] /signals: ranked Ledger by tier, archive fold, lens, sorts, dimension filter, URL state
- [x] Audit/watch: rule-box forms + inline errors; audit report (Quiet); watch Ledger with feed copy; voice empty states
- [x] MCP: collections tool + brand similar (28 tools)
- [x] Tests, screenshots, report
