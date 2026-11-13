# Type Trends Wire

PROJECT: DSGN/TERMINAL — a live design-trend terminal. Think Bloomberg terminal, but the markets are typefaces, colors, layouts and design news. It is a standalone portfolio piece for Brandon Forant (product designer, brandon.wtf). Visitors should feel they are looking at the backend of the internet: dense, precise, alive.

This is PHASE 1 of 3. Build the full UI shell, design system, database schema and the two MVP panels that read real data. Do NOT build data ingestion yet (phase 2 adds edge functions + cron). Do NOT build an MCP server yet (phase 3). Do not invent features beyond this brief. No auth, no login: the whole app is public and read-only.

=== 1. BACKEND (Lovable Cloud / Supabase) ===
Enable Lovable Cloud and create exactly this schema as a migration:

create table public.gfont_snapshots (
  captured_on date not null,
  family text not null,
  category text not null,
  popularity_rank integer not null check (popularity_rank > 0),
  trending_rank integer not null check (trending_rank > 0),
  is_variable boolean not null default false,
  primary key (captured_on, family)
);
create index gfont_snapshots_family_idx on public.gfont_snapshots (family, captured_on);

create table public.wire_items (
  id bigint generated always as identity primary key,
  url text not null unique,
  title text not null,
  source text not null,
  source_kind text not null check (source_kind in ('rss','hn')),
  published_at timestamptz not null,
  excerpt text,
  tags text[] not null default '{}',
  fetched_at timestamptz not null default now()
);
create index wire_items_published_idx on public.wire_items (published_at desc);
create index wire_items_tags_idx on public.wire_items using gin (tags);

create table public.ingest_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  ok boolean not null,
  rows_written integer not null default 0,
  detail jsonb
);

alter table public.gfont_snapshots enable row level security;
alter table public.wire_items enable row level security;
alter table public.ingest_runs enable row level security;
create policy "public read" on public.gfont_snapshots for select to anon, authenticated using (true);
create policy "public read" on public.wire_items for select to anon, authenticated using (true);
create policy "public read ok runs" on public.ingest_runs for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.wire_items;

Column meanings: popularity_rank = Google Fonts usage rank (1 = most used). trending_rank = Google Fonts momentum rank (1 = fastest rising). One row per family per day. "Positive change" always means a family climbed that many places (old rank minus new rank).

The front end only ever SELECTs. Tables will be empty until phase 2; every panel must handle empty data gracefully (see empty states).

=== 2. DESIGN SYSTEM (put these in tailwind config + CSS variables; use them everywhere) ===
Type: one monospace family only — "Geist Mono" from Google Fonts, fallback ui-monospace. Sizes: 11px (labels, meta), 13px (body, table rows), 20px (panel hero numbers), 48px (one big number per view max). Weights 400 and 600 only. Labels UPPERCASE with 0.08em tracking. All numbers tabular-nums, right-aligned in tables.
Color — no color in the chrome:
--black #000000 (page + live panels, "blackspace")
--grey-900 #0E0E0E (panel headers, structure)
--grey-800 #161616 (dormant panels, "greyspace")
--rule #262626 (1px hairlines between everything)
--grey-500 #6B6B6B (secondary text, timestamps)
--white #EDEDED (primary text)
--paper #F2F2F2 (the ONE inverted surface: the Weekly Brief strip — black text on paper, used to create negative-space contrast)
--signal #FF4F00 (the ONLY accent: rising values, live dot, cursor). Falling values use --grey-500 with ▼. Rising use --signal with ▲. Never use any other hue except real data swatches.
Shape: no border radius anywhere, no shadows, no gradients, no blur. 1px rules only. 8px spacing grid; panel padding 12px.
Motion (functional only): ticker crawl, digits that roll when a value changes, new wire rows slide in from top (150ms), blinking block cursor in the query bar (1s). Respect prefers-reduced-motion: disable crawl and rolls.

=== 3. LAYOUT (single route "/") ===
Top bar (height 32px, --grey-900, bottom rule): left "DSGN/TERMINAL" in 600 weight + "v0.1"; center the F-key bar; right: live dot (--signal, pulsing) + "LIVE", UTC clock HH:MM:SS updating every second, and "LAST WIRE INGEST hh:mm UTC" read from the latest ok row in ingest_runs where job='ingest-wire' (show "—" if none).
Ticker strip (height 28px, below top bar, bottom rule): horizontally crawling text of top movers: for each of the top 12 families by 7-day popularity climb, render "$TICKER ▲12 #84" (ticker = family uppercased, non-alphanumerics replaced by "-", prefixed "$"). Falling ones use ▼ in grey. Loops seamlessly. If fewer than 2 snapshot dates exist, crawl the 12 top trending_rank families as "$TICKER TRND #3" instead. If no data: crawl "AWAITING FIRST INGEST · DATA COLLECTION BEGINS ON DEPLOY ·".
F-key bar: buttons F1 OVERVIEW, F2 TYPE, F3 COLOR, F4 LAYOUT, F5 COMPOSITION, F6 LEXICON, F7 VIBE, F8 WIRE, F9 REBRANDS, F10 BRIEF. Keyboard: physical F1–F10 and number keys 1–0 switch panels (preventDefault on F-keys). Active key: --white background, black text. "/" focuses the query bar, "?" opens a keymap overlay (black, 1px rule border, list of keys), Esc closes it.

Main area per panel:
F1 OVERVIEW (default): a 12-column character grid. Row 1: four stat cells across — "FAMILIES TRACKED" (count of families on latest snapshot date), "SNAPSHOT DAYS" (count distinct captured_on), "WIRE ITEMS / 24H", "TOP RISER 7D" ($TICKER + ▲n). Below: left 7 columns = compact Type Index (top 10 rows), right 5 columns = Wire (latest 15). Bottom: the Weekly Brief strip on --paper (black text): header "WEEKLY BRIEF · WEEK nn" and text "First brief publishes after 7 days of data." (static for now).
F2 TYPE INDEX: full table. Columns: RANK (popularity_rank), TICKER, FAMILY, CAT, VF (● if variable), POP Δ7D, POP Δ28D, TRND (trending_rank), BAND, and a 64×16px sparkline of popularity_rank over the last 28 days (inverted so climbing goes up; 1px --white line, last point a 2px --signal dot when rising). Controls row above: category filter (ALL / SANS / SERIF / DISPLAY / HAND / MONO), sort toggle (RISING 7D / RISING 28D / FALLING 28D / TRENDING NOW), and the query bar ("> " prompt + input + blinking block cursor) that filters by family name. Paginate 50 rows. Clicking a row opens a right-side detail drawer (480px desktop, full-screen on mobile): ticker large, family, category, current ranks, Δ7/Δ28, band + one-line reason, a full-width line chart of popularity_rank history (inverted axis, hairline grid, x = date), a live specimen line "The quick brown fox — 0123456789" rendered in that actual Google Font (load via fonts.googleapis.com css2 on demand), and a RECEIPTS block: "SOURCE Google Fonts Developer API · SNAPSHOT yyyy-mm-dd · n DAYS OF HISTORY".
BAND rules (compute client-side from that family's history, newest snapshot vs the latest snapshot at least 7 / 14 / 28 days older):
- fewer than 42 days between first and latest snapshot → "BASELINE" (grey), reason "Collecting history: n of 42 days".
- RISING: 28d popularity climb ≥ max(5, 5% of old rank) AND trending_rank ≤ 200.
- PEAKING: popularity_rank ≤ 100 AND trending_rank worsened ≥ 50 places over 28d.
- RETURNING: 28d popularity drop ≥ max(5, 5% of old rank) but climbed in BOTH the last 7 days and the 7 days before that.
- FADING: 28d popularity drop ≥ max(5, 5% of old rank).
- else STEADY.
Render bands as text tags: RISING in --signal, others --grey-500/--white. Put this logic in one pure module src/lib/bands.ts so phase 3 can mirror it.
Efficient fetching: for the table, fetch the latest snapshot date, then rows for latest date and the dates nearest 7 and 28 days earlier (paginate past the 1000-row PostgREST limit with .range()). Fetch the 28-day sparkline history only for the visible page of families. Cache with TanStack Query (staleTime 5 min).
F8 WIRE: full-height live feed. Each row: time (HH:MM, grey), SOURCE (uppercase, 11px, fixed 18ch column), title (white, opens url in new tab), tag chips as plain bracketed text "[type] [brand]". Filter row: tag toggles (ALL TYPE COLOR BRAND UI WEB MOTION AI), source dropdown, query bar matching title/excerpt. Subscribe to Supabase realtime INSERTs on wire_items: new rows slide in at top with a 2s --signal left rule that fades out. Hovering a row shows the excerpt in a 1px-bordered tooltip. Show only headline + source + link; never full article text.
F3 COLOR, F4 LAYOUT, F5 COMPOSITION, F6 LEXICON, F7 VIBE, F9 REBRANDS, F10 BRIEF: dormant panels. Full panel in --grey-800 with a subtle 45° hairline hatch (repeating-linear-gradient of --rule, 1px every 8px — the only allowed gradient). Centered block: panel name, status "OFFLINE", and one line each:
 COLOR — "Hex clusters and palette temperature. Arrives with the crawler."
 LAYOUT — "Hero patterns, grids, nav styles. Arrives with the crawler."
 COMPOSITION — "Density, whitespace ratio, balance. Arrives with the crawler."
 LEXICON — "Rising words in hero copy and design discourse. Arrives with the crawler."
 VIBE — "Mood clusters on a 2D map. Arrives with the crawler."
 REBRANDS — "New identities, type and color extracted. Phase 2."
 BRIEF — "Auto-written weekly market report. After 7 days of data."
 Plus a fake-but-honest progress line: "SIGNAL ACQUISITION ░░░░░░░░░░ 0%".

Empty states for live panels: monospace line "NO DATA · AWAITING FIRST INGEST" plus "Collection runs daily (type) and every 15 min (wire)." No illustrations, no spinners — use a blinking "▍" for loading.

Footer (24px, top rule): "DATA: GOOGLE FONTS DEVELOPER API · DESIGN RSS · HACKER NEWS" left; "BRANDON.WTF" link right; center "METHODOLOGY" button opening an overlay with the band rules above in plain text.

=== 4. RESPONSIVE (all major breakpoints) ===
≥1280px: full terminal, grids as described. 768–1279px: Overview becomes 2 columns (Type Index top, Wire below); F-key bar scrolls horizontally; drawer 420px. <768px: single stacked feed — top bar shows only logo, live dot and clock; ticker stays; F-key bar becomes a fixed bottom key bar showing F1 F2 F8 and a "MORE" button that opens the rest; Type Index table drops CAT, VF, Δ7D and sparkline columns; detail drawer full-screen. Minimum tap target 40px on mobile. No horizontal page scroll at any width.

=== 5. QUALITY BAR ===
Accessible: semantic table markup, visible 1px --white focus ring, aria-live="polite" on the wire list (announce count only, not every title), contrast ≥ 4.5:1 for text. Page title "DSGN/TERMINAL — design trend terminal". Favicon: a 16px black square with a --signal block cursor. Meta description: "A live terminal for design trends: typefaces, color, layout and design news, measured weekly."

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://type-trends-wire.lovable.app

## Crawler queue endpoints

The GitHub crawler (`crawler/`) renders URLs that LITE analysis could not cover. Both endpoints use the same crawler secret as `library-state` and `library-tag`: send `Authorization: Bearer <secret>` (the existing `x-crawl-secret` header is also accepted). The server compares a SHA-256 hash of the secret with the stored hash; a missing or wrong secret returns `401`. No secret values are stored in this repository.

- `GET /api/public/crawl-requests?limit=N` — `N` is 1–25 (default 10). Returns `{"requests":[{"url","domain","requested_at"}]}`, oldest pending first.
- `POST /api/public/crawl-requests` — body `{"results":[{"url","status":"done"|"error","error"?,"signals"?}]}`, at most 25 results, `error` ≤ 300 characters, body ≤ 64 KB, unknown fields rejected. Each result adds one attempt; `done` sets `done_at`; `error` records `last_error` and returns the URL to `pending` until it has been attempted 3 times, after which it stays `error`. Returns `{"updated":[{url,status,attempts}],"skipped":[{url,reason}]}` (`unknown`, `not_pending`, `conflict`).

A `done` result may carry `signals` (the crawler's rendered page analysis object); `signals` on an `error` result is rejected. Signals are stored privately with `rendered_at` and are never exposed publicly. `critique` and `differentiate` use a rendered result for a non-library URL (exact URL, or the same host+path ignoring `www.` and trailing slashes) when it is at most 30 days old; older results are re-queued when the URL is analysed again, keeping the old signals until replaced. A new rendered result clears cached responses for that URL.

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/917ab2ab-52dd-46f4-9151-8504b8f1a60f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
