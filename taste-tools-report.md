# Taste Tools verification

Not published. Existing Lovable Cloud and public MCP service retained; no new auth, storage service or connector enabled. The manifest now contains 18 tools; extraction does not establish a hosted deployment.

## Real runs
- `recommend_type({sector:'fintech',role:'headline'})`: Coinbase Text first, share 3.8%, score 0.275, example coinbase.com; Arcadia Text next, share 3.8%, score 0.058, mercury.com. License hints commercial, not confirmed licensing advice.
- `recommend_type({role:'pair'})`: Manrope / Inter first, 3 observed sites, 0.38% share, score 2.761, one of 30 trendsetters, vanguard lead 5.14 pts. Both Google/free; same-category contrast needs size/weight hierarchy.
- `recommend_palette({sector:'ai',theme:'dark'})`: Cerebras palette bg #2E2E2E, fg #FDFEFE, accent #F15A27, supports #1A1A1A / #FD975B. Text contrast 13.44; accent/background 4.03 (not qualified for normal text). Ticker adoption 17.2%, low risk, score 1.281. Foreground selected from measured palette, not original text-color measurement.
- `differentiate({sector:'dev-tools'})`: 30 library sites. Technical tone 100%; variable fonts 96.7%; product UI imagery 86.7%. Open territory starts with product photography, collage and newsletter signup, supported by trendsetter adoption. CSS features are also returned as convergence evidence.
- `critique({url:'https://linear.app'})`: library mode, 22 of 43 observed choices overlap consensus; era estimate 2026. Suggestions cite forecast rows and trendsetter examples. Most stages remain unknown where quarterly coverage is insufficient.
- `critique({url:'https://example.com'})`: lite mode; insufficient evidence for a verdict, no guessed era. URL queued once for rendering. Declared CSS, not rendered measurements.

## Verification
- 298 tests passed across 28 files, including numeric scoring penalties, query precedence, era, colors, SSRF, brief cache, public-budget rejection and unknown outcome accounting.
- MCP HTTP recommend_type returned 200 with recommendations and receipts.
- Slash console returned real recommendations; history up-arrow and Escape verified. Shareable palette commands rendered at 360/768/1024/1440 with no horizontal page overflow or browser errors.
- Latest automatic build reports OK.
- Catalog 2,542; usage rows 1,189; pairs 480; color rows 500; palette examples 754.
- One classification pass: eight calls, 376 unknown names, 330 classified, 46 left unknown. 2,431 input / 5,643 output tokens, estimated $0.00907225. Public budget initialized to $5/month, distinct from ingestion/backfill budgets; existing brief kind preserved.

## Boundaries and remaining validation
- LITE pins validated IPs through the HTTP transport and fails rather than falling back to unpinned fetch. It was exercised in the local runtime, not hosted workerd; production compatibility of custom lookup must be confirmed before relying on non-library URL analysis after publication.
- Image critique uses transient closed-vocabulary tags; no pixel palette quantization, font guesses or app image persistence. No real image inference was run in this phase.
- Font/color quarter series currently use raw quarterly homepage samples; archive declared-font fallback and full crawl-run historical series are not yet wired into these new usage models.
- Brief tags bias individual-face recommendations. Pair and palette brief-specific tone/aesthetic affinity remains incomplete.
- Palette supports can contain fewer than two colors when measured data lacks them. The console receipts line includes samples/date/bias, but does not expand the entire model card; full receipts are returned by tools.
- Public cache is service-role-only. Tool response caching lasts seven days; shared data is keyed daily. Concurrent identical cache misses are not single-flight across instances.
- Global AI cap is enforced at reservation level (each paid model call), conservatively including font classification batches. MCP budget failures are tool errors; console uses HTTP 429. A transport-level MCP 429 for daily-cap rejection remains incomplete.
- Existing managed schedule 90-second timeout limitations remain unchanged.

## Files
Pure/server modules: `src/lib/taste/*`; console call: `src/lib/taste.functions.ts`; UI: `src/components/terminal/TasteConsole.tsx`; four MCP tools under `src/lib/mcp/tools/`; storage/guards in migration 0029. Existing forecast job, data query options, index search parameters, F10 drawer, MCP overlay/methodology and catalog registration updated. Crawler code/workflow untouched.