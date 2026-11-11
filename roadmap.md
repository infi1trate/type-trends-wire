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