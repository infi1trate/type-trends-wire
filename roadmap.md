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
- [ ] Product Hunt stays dormant until Brandon adds PRODUCT_HUNT_TOKEN.
# Phase 6A — showcase (terminal side)
- [ ] F9 Rebrand Desk: identity-change log from confirmed live + archive events, before/after rows, forecast read, wire match, filters, MCP `rebrands`, methodology.
- [ ] F7 Vibe Map: pure tag-vector PCA + k-means with named clusters, weekly `vibe_points` storage, scatter UI with keyboard, MCP `vibe_map`, methodology.
- [ ] Chart of the Week: stored card per brief, /chart and /chart/$week pages, SVG + PNG (1200×675, 1080×1350), og:image, F10 block; generate current card.
- [ ] Tests (PCA/k-means determinism, naming, rebrand rules, SVG snapshot, routes) and report; no publishing.
