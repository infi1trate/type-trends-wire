<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI provider.** Model calls go through `src/lib/ai-provider.server.ts`:
  `AI_PROVIDER=lovable` (default, Lovable gateway) or `google` (Gemini API
  direct with `GEMINI_API_KEY`, failing closed without it). Keep
  `LOVABLE_API_KEY` and `GEMINI_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Evidence calendar and rise timing use the share charts' forecast coverage constants and fail closed on missing coverage; stored blocks are revalidated without writer calls after dossier corrections so stale evidence cannot remain public.
- Chart readouts share chartkit/Interaction with pure movement rules; explicit study/series coordinates or existing named SVG marks drive feedback only on intent, so resting charts and reader data reads stay unchanged.
- Editorial row type, display percentage signs and section rhythm use the theme/system roles; the Read gap snaps to the existing density ladder without modifying shipped editions, while Terminal retains its own spacing.
- Brand identity tiles use the shared read/BrandMark at the token scale, with stored-dimension eligibility and neutral initials; this keeps loading boxes and missing marks aligned in both views.
- Band classification lives only in `src/lib/bands.ts` (pure, dependency-free) so the phase-3 MCP server can mirror it; covered by `src/lib/bands.test.ts`.
- All frontend Supabase reads go through query options in `src/lib/data.ts`; the front end only SELECTs and paginates past 1000 rows with `.range()`.
- Terminal UI components live in `src/components/terminal/`; the terminal uses `/` and library detail uses `/library/$domain` so site records are shareable and SSR-safe.
- Ingestion uses cron-authenticated `/api/public/` callbacks with privileged writes in `src/lib/ingest.server.ts`; this keeps the terminal public-read-only and secrets server-only.
- Shared ingest parsing/ranking lives in `src/lib/ingest.ts` with focused tests; cap outbound fetch concurrency at six for the hosted runtime.
- Google Fonts ingestion calls the configured connector gateway, never the provider with the connection credential, because connection credentials are gateway keys.
- MCP tools use the supported defineMcp toolkit and a shared anonymous SELECT-only client; public exposure must not bypass existing RLS.
- The MCP HTTP boundary adds bounded per-IP throttling and a methodology-resource compatibility adapter, because the toolkit currently only registers tool and app resources.
- HTML entity decoding is shared by ingest and render safety checks; a one-time maintenance script repairs existing rows without changing recurring jobs.
- Crawler writes use a dedicated dynamic-imported server handler with SHA-256 shared-secret authentication, bounded streaming bodies, and a pure payload schema; private live aggregates retain security_invoker and filter to publicly readable ok sites.
- The design crawler lives in `crawler/` (plain Node + Playwright, its own package.json and node:test suite) and runs only on GitHub Actions via `.github/workflows/crawl.yml`; it is not part of the app build. It posts to `/api/public/ingest-crawl`.
- Crawler panels share one hydration-safe language-scope provider and paginated query options; scope-specific aggregates are materialized behind owner-rights public facades because visitors cannot read private live/materialized objects.
- Crawler posts only store and mark (`work_marks`: crawl summaries after finish or finished-run reposts, archive replays, a forced sweep); the wire follow-ups pass is the one worker that does marked work from the newest state, and a post whose marks cannot be written fails so the crawler's retry leaves nothing unmarked, because heavy work inside posts held the crawler 35–40 s and coincided with the 23 Nov outage.
- Library field extraction/equality and two-capture advancement stay pure in `src/lib/library-diff.ts`; transactional RPC writes atomically persist private baseline/pending state with snapshots/events under per-domain locks and optimistic retries. Historical replay uses the same advancement and atomically replaces history only if the snapshot set is unchanged.
- Library state uses a service-role-only DISTINCT ON RPC after crawler-secret verification; public views exclude raw text, which lives in an RLS-locked separate table.
- Library UI queries use server functions wrapped by `src/lib/data.ts` query options with a shared anonymous SELECT-only store; MCP reuses the store and returns projected fingerprints without skeleton or private text.
- Baseline surface eligibility is computed in transactional snapshot context and checked by pure diffs; require an existing domain capture strictly more than 24 hours earlier to prevent first-run noise.
- AI inference uses the provider layer with atomic cost reservations; vision unknown outcomes are never replayed, while interrupted idempotent text jobs retry below three attempts only after charging orphan reservations in full.
- AI confirmation uses a separate private baseline keyed by domain/page/viewport/kind and the existing pure advance function, so late AI output cannot clear measured pending changes or count one snapshot twice.
- Vision inference sends image data directly to the configured AI provider in memory; never persist images or log request/provider bodies, so app storage contains derived tags only.
- Vision quality is normalized before persistence; blocked or low-confidence captures break AI change confirmation and are excluded after latest-snapshot selection from trend denominators and reuse.
- Vision sends the fold plus up to four labeled top-to-bottom sections; sections supersede the legacy page strip to bound inference at five images while retaining old callers.
- Text workers incrementally claim at most three distinct-key jobs concurrently, stop claiming at 50 seconds, abort inference at 57 seconds for cleanup within 60 seconds, and cap runs at 25 during active backfill or 10 otherwise; validation failures get one durable correction retry.

- Wayback measured confirmation stays source-keyed; archive AI uses a distinct internal baseline kind so live candidates cannot be altered by historical tagging. Archive changes confirm through chronological per-domain two-capture replay; all public event tapes are live-only.
- Quarterly history views select one desktop home sample per site/quarter, prioritize current live samples, flag sparse coverage, and share anonymous paginated reads between Library charts and MCP.
- Font comparison and SQL history keys strip next/font hashes before suffix normalization; declared archive stacks skip fallback families so hashed aliases cannot create false changes.
- Forecast math stays pure in `src/lib/forecast*.ts` (model, signals, brief validation, one constants file); `forecast.server.ts` only loads public aggregates and writes a run, so models stay testable and MCP/UI read the same stored run.
- Taste tools share pure math and one server handler layer between MCP and slash-console query options; anonymous reads stay separate from private cache, crawl requests and atomic public-AI reservations.
- LITE outbound requests validate DNS and pin the approved address in the transport, failing closed when unavailable, so redirect and DNS-rebinding checks cannot be bypassed by an ordinary fetch.
- The living design register, rules, gate and editions stay pure in `src/lib/living/`; tokens read the shipped edition values from code (`SHIPPED` in `editions.ts`) while the insert-only edition tables only record proposals, moves and statuses, so no page reads the database for its look.
- The newsroom's rules stay pure in `src/lib/newsroom/` (register of desk actions with levels, the door's decision, story states derived from stored rows, ET spend week and cap, memory fit, docs generated from code constants); `newsroom.server.ts` and `memory.server.ts` only read and append, and every authenticated `/api/public/desk` call is logged through the one door, so desk sessions, the desk page and tests share one rulebook.
- `newsroom/style.md` lists and `newsroom/beats.md` are written from code by `scripts/newsroom-docs.ts` and checked by test; writer versions are prompt fingerprints in `golden/versions.ts` with score files in `newsroom/scores/`, so a prompt or model change fails the build until it is scored against the frozen writing set.
- Public critique/differentiate may add new URLs to the render queue only under the caps in `src/lib/crawl-requests.ts` (fail closed), so anonymous callers cannot point the crawler at unbounded sites.
- Page structure (J1/M1) is pure in `src/lib/structure.ts` (derivation, signals registry, counts, 15-brand floor; missing reading = null, never zero); the weekly forecast's `structure` follow-up writes `library_structure_records`/`_series` from a bookmark and pages only read those rows, because heavy work in request paths caused the 23 Nov outage.
- Navigation derivation unions stored links and menu buttons without rebuilding history; the shared charts mark the dated reading join, and section strips cap unread tails at the stored extent.
- Designer-kit copy payloads stay pure in `src/lib/take-away.ts` over stored identity and structure fields; CSV exports reuse `tableCsv` and one shared copy control handles clipboard feedback.
- Reference boards and comparison read `brand_kit_records`, built by a bounded designer-kit follow-up in the existing weekly forecast queue; membership and filters stay pure, and crop URLs are loaded separately through current public visibility rules.
- Comparison rows and TSV stay pure in `src/lib/compare.ts`; directory and compare search share `BrandSearchInput`, so stored readings and keyboard search use one rule.
- Onboarding brands are stored `active = false, onboarding = true` and never pass through the `library_sync` RPC (split in `src/lib/library-sync.ts`); only the panel step makes them active, because every view and reader already treats inactive as "not in the library".
- App Store listings (M2a) are stored only, through `/api/public/ingest-listings` into three service-role tables (per app, per version, slim per week) so text is kept once; nothing reads them until a study is built (see `src/lib/listings/AGENTS.md`).
