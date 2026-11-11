# Phase 5C — AI tagging and extraction

## Result
Turn Library captures into countable design tags, pricing, shipping cadence and product themes, while keeping measured signals distinct from AI results. Preserve the terminal style, private page text, existing crawler behavior and two-capture confirmation. Do not publish or change the crawler.

## 1. Build the spending guard first
- Add private `ai_usage` and `ai_budget` tables, with the requested $50 monthly and $100 backfill budgets. Seed the budgets through a separate database data operation; the backfill expires 21 days after setup.
- Implement and test pure cost estimation and budget selection. Backfill gets charged first while active and unexpired, then monthly; a reservation must fit wholly within an available budget.
- Reserve a conservative maximum cost atomically before each inference, including concurrent vision requests and worker jobs. Settle against actual response tokens after inference. Keep uncertain/billed failures reserved rather than counting them as free.
- Expose only aggregate spend and counts through `ai_spend_summary`; add the requested F11 spend line.

## 2. Add transient-image tagging
- Add the crawler-secret-authenticated `/api/public/library-tag` route with streaming 2 MB body enforcement and a dynamically imported handler.
- Validate domain, home/desktop key, capture timestamp, signals hash and JPEG data URLs. Match the live snapshot and reject mismatched hashes.
- Reuse validated tags for an identical domain/hash tagged strictly less than 60 days ago. Deduplicate simultaneous requests for a snapshot before generation.
- Otherwise send short measured context and the fold/full-page images to the vision model, force a schema-defined function result, clean closed vocabularies and validate before storing only tags and metadata.
- Return `{ok:true,reused:boolean,tags}`; budget exhaustion returns HTTP 429 with `{ok:false,code:'budget_exhausted'}`. Missing snapshots return 404; invalid credentials return 401.

### Image privacy prerequisite
The selected Chat Completions model surfaces advertise zero provider retention. That does **not** prove that Lovable Gateway request logs never retain image payloads. The installed SDK exposes no documented per-call logging-disable option. Establish an image-payload omission guarantee before enabling live vision calls; if that guarantee cannot be established, complete the non-image work and leave vision explicitly blocked rather than violate “images never stored anywhere.” No images, raw text or provider error bodies will enter app logs or database records.

## 3. Add queued text extraction
- Add private `library_ai_jobs`, public-read `library_extractions`, and durable worker status/lease records.
- Extend the transactional snapshot-store operation to enqueue only desktop pricing/changelog/product captures with private text. For unchanged non-null content hashes, copy an existing valid extraction; if the predecessor is still queued, defer/copy on completion instead of duplicate inference.
- Add the cron-authenticated worker with at most 10 jobs per run, at most 3 concurrent calls, and text truncated to 12,000 characters.
- Use a database single-flight lease, per-item claims and atomic completion. Never automatically replay an ambiguous inference outcome.
- Persist and expose a safe pause reason on credit/policy denials, provider refusals and repeated rate limits; check paused state at every scheduled entry point. Provider denials receive no probes.
- Configure the requested five-minute managed schedule after the protected handler exists, preserving all existing schedules. This is up to 288 checks per day, with a maximum normal queue wait of five minutes; idle checks can increase Cloud costs.

## 4. Aggregate and confirm changes
- Add public tag-share, pricing, changelog and feature-theme views. Use latest eligible live desktop captures per active site, overall/per-sector groups and capture-time-based 28-day comparisons. Missing historical coverage produces unknown deltas, not zero.
- Keep untagged sites out of tag denominators and count each site once per dimension/value or feature theme.
- Extend pure confirmation fields for desktop-home imagery/aesthetic sets and pricing extraction plan membership/cheapest monthly price. Jaccard below 0.5 marks tag-set differences.
- Persist AI confirmation separately from measured fields so late AI results cannot clear measured pending candidates. Reuse the existing pure `advance()` rules, lock by key, reject out-of-order baseline advancement and prevent repeat tagging of one snapshot from counting as two captures.
- Add `imagery_shift` and `aesthetic_shift` to event validation without removing existing event types. AI-derived events receive an AI marker.

## 5. Library displays and MCP
- F11: AI tags/movers with the existing sector filter, pricing table, feature themes and real tagged coverage.
- Site detail: AI tag groups, confidence/model/date, pricing plans, changelog entries/cadence and product features under the fingerprint. Keep measured HEADLINE as ordinary text.
- Route all public reads through existing query options and the anonymous SELECT-only store, with pagination where needed.
- Add `library_trends({dimension?,sector?})` to the existing MCP server and update `trend://methodology` with models, closed vocabularies, privacy boundaries and budget caps. Re-extract the manifest; retain existing authentication policy and throttling.

## Technical choices
- Vision: `google/gemini-3-flash-preview`, cheapest non-deprecated Flash-class vision model currently eligible on Chat Completions. Estimated USD per million tokens: input $0.50, output $3.00.
- Text: `google/gemini-3.1-flash-lite`, cheapest non-deprecated eligible Flash-Lite-class model. Estimated USD per million tokens: input $0.25, output $1.50.
- Centralize model IDs, estimated provider-list prices and conservative token bounds. Keep generated SDK contracts and use the supported SDK only, without manual key forwarding.
- Structured output uses forced function calling with JSON schemas plus independent Zod validation. Derive monthly pricing, cheapest paid plan, changelog cadence/AI share and feature-primary-theme consistency from validated output rather than trust inconsistent model totals.
- Database changes are additive migrations with explicit grants, RLS and service-role-only functions for privileged writes. No public access to usage rows, budgets, job inputs, private text or private confirmation state.

## Verification and report
- Tests: exact budget caps/expiry/priority/concurrent reservation behavior, every closed vocabulary and output schema, 60-day hash reuse, request limits/auth, enqueue deduplication, worker bound/pause behavior, trend denominators/history and two-capture AI confirmation.
- Run one real pricing extraction on an existing private-text snapshot and read its public result through the UI; record actual usage. Run one real vision request using an in-memory small JPEG only after the image-log privacy prerequisite is satisfied.
- Check F11/site pages at 360, 768, 1024 and 1440px, unknown-domain handling, public MCP results and private-data exclusion; run the test suite and inspect current compilation diagnostics.
- Report chosen models and price constants, files changed, actual usage, the exact tag request/response contract and any remaining external blocker. Leave publishing to Brandon.