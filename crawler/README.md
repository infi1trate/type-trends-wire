# dsgn-crawler

Weekly crawler for DSGN/TERMINAL (type-trends-wire.lovable.app). It renders homepages in headless Chromium, pulls out design signals, and posts them to the terminal. It stores derived data only: no screenshots, no page copy beyond headlines and button labels.

## Two indexes

| Index | Seeds | What it tells you |
| --- | --- | --- |
| `mainstream` | Chrome UX Report top origins (global, top-5,000 buckets, [crux-top-lists](https://github.com/zakird/crux-top-lists)); Tranco fallback | What the web people actually visit looks like |
| `vanguard` | `seeds/vanguard.txt` (hand-picked studios and startups) + Show HN launches with 25+ points from the last 180 days | What new and design-led sites look like |

Domains are deduped across both indexes (mainstream wins). The gap between the two is the leading signal: what vanguard does now, mainstream does later.

Filters: infra/CDN domains, logged-in app subdomains (`mail.`, `app.`, …), adult domains by pattern, plus any page self-labelled adult (RTA meta) at crawl time. robots.txt is respected for the homepage. The user agent identifies itself as `DSGNTerminalBot`.

## What it measures per site (first 1440×900 viewport)

- **Type:** fonts the browser *actually rendered* (via CDP, not the CSS stack) for h1, h2, body, nav and CTA, plus declared h1 size, weight, tracking and case.
- **Color:** screenshot palette (top 8 by pixel share), theme (dark/light from the page background), accent (first saturated CTA color), body text contrast, whitespace ratio.
- **Layout:** h1 alignment, h1 lines and words, hero media (video / webgl / image / none), nav link count, CTA count and shape (radius; 999 = pill), grid columns, page height, sections.
- **Composition:** text density, media coverage, whitespace.
- **Lexicon:** h1, h2s, meta description, CTA labels.
- **Tech:** Next, Framer, Webflow, WordPress, Shopify, Tailwind, GSAP, Lenis, three.js, and others.

## Setup

This folder lives inside the Lovable-synced repo; the workflow is `.github/workflows/crawl.yml` at the repo root. The endpoint is hard-coded in the workflow; only the secret is needed.

1. GitHub repo → Settings → Secrets and variables → Actions → New repository secret: `CRAWL_SECRET` = the value Claude gave you (the terminal stores only its SHA-256 hash).
2. Actions → **weekly-crawl** → Run workflow. First time: `per_index: 25`, `dry_run: 1`, and download the `crawl-out` artifact to check it. Then run with the defaults (500 + 500).
3. After that it runs every Sunday 03:23 UTC (~30–45 min).

## Local

```
cd crawler
npm install && npx playwright install chromium
npm test                                   # robots + filters + full dry run on 3 fixture sites
DRY_RUN=1 PER_INDEX=10 npm run crawl       # real seeds, writes out/<run>.jsonl
```

Edit `seeds/vanguard.txt` to shape the vanguard. It's the taste half of the market.

## Known limits

- Homepage, first viewport, desktop only. Mobile and inner pages come later.
- Global CrUX skews toward non-English sites; every record carries `lang` so the terminal can filter.
- Show HN sites lean dev-tool and indie. Add studios and brands to `vanguard.txt` to balance it.
- Some sites block headless browsers or bots; those show up as `http_403` or `timeout` in the run stats.

## Library mode (`npm run library`)

Tracks the 300 sites in `seeds/library.csv` (10 sectors × 30) over time. `.github/workflows/library.yml` runs it:

- **full** (Saturdays, or dispatch `mode=full`): posts `library_sync`, renders each home page, discovers pricing / changelog / product / about from same-host links, snapshots each page at 1440 desktop plus the home page at 390 mobile.
- **check** (daily): reads `/api/public/library-state`, refetches the server HTML of every page already captured, and re-renders only pages whose `html_hash` moved.

Each snapshot carries the index-crawl signals plus `css_features`, `nav` (label/href/depth), `skeleton` (≤400 boxes for a wireframe redraw — no screenshots are stored), and three hashes (`html_hash` server HTML minus volatile bits, `content_hash` visible text, `signals_hash` design-relevant fields). Desktop pages also send `raw_text` (≤50k chars) for later extraction; the terminal keeps it private. The terminal diffs consecutive snapshots into `library_events`.

Env: `LIBRARY_MODE`, `LIMIT`, `LIBRARY_FILE`, `STATE_FILE` (dry runs), plus the shared `CRAWL_ENDPOINT` / `CRAWL_SECRET` / `DRY_RUN` / `CONCURRENCY`.

## Wayback, ad hoc (`LIBRARY_MODE=wayback`)

Older half-year path inside `library.js` (with `SECTOR`, alternates on blank renders). Kept for one-off runs; the scheduled backfill below supersedes it.

## History backfill (`npm run wayback`)

Renders archived homepages from the Internet Archive (`/web/<ts>if_/` playback: archived assets, no toolbar) — one capture per quarter per library site since 2021Q1, closest to mid-quarter. Coarse-first: every site's Q1s, then Q3s, then Q2/Q4, sector-interleaved, so a partial backfill is already a usable yearly history. `.github/workflows/wayback.yml` runs every 6 hours; each run asks `/api/public/library-state?source=wayback` what exists and continues. Gentle on the Archive: one page start per 2.5 s across workers, global back-off on 429/503. Snapshots post as `source:"wayback"` with `signals.archive = {timestamp, quarter, fonts_total, fonts_failed}` (archives often miss font files — the terminal falls back to declared fonts) and are tagged like live pages. If the nearest capture renders blank, up to two alternates in the same quarter (≥14 days apart) are tried.

## Render queue (`npm run requests`)

The public `critique` tool can only read declared CSS for sites outside the library ("LITE" mode), and queues those URLs. `.github/workflows/requests.yml` runs every 2 hours: it peeks at `GET /api/public/crawl-requests` (crawler secret as `Authorization: Bearer`), and if anything is pending renders up to `LIMIT` URLs with the same pipeline as the index crawl, then `POST`s one result per URL (`{url, status: done|error, error?, signals?}`) back to the queue. Errors return to pending until the third attempt.

Queued URLs come from anonymous users, so they are untrusted: http(s) on ports 80/443 only, no credentials, every hostname (including redirects and subresources, via request interception) must resolve to public addresses, robots.txt is checked for the exact path, and the adult/gambling filters apply. Signals are trimmed to fit the 64 KB body cap. Local test: `DRY_RUN=1 QUEUE_FILE=queue.json ALLOW_PRIVATE=1 npm run requests`.

## Curated index (Phase 5)

A third index next to mainstream and vanguard: sites design galleries are featuring right now. `src/galleries.js` renders the first one or two listing pages of Land-book, Awwwards (Sites of the Day), Minimal Gallery, One Page Love, CSS Design Awards and SaaS Landing Page (robots.txt checked, a pause between pages) and keeps only outbound links to featured sites — no gallery images or text. Gallery chrome, sponsors, builder referral links and socials are filtered out. The terminal adds Are.na and Product Hunt domains via `GET /api/public/seed-candidates`. The index stays disjoint from mainstream/vanguard, and each site row carries `galleries` (which sources featured it). Curation lead = curated share − mainstream share. Godly was dropped: it no longer links out to sites. The weekly workflow crawls all three (`INDEXES`, `PER_CURATED` default 300).

## Discourse sampler (`npm run jetstream`)

`.github/workflows/jetstream.yml` listens to Bluesky's public Jetstream for 30 minutes every 4 hours (~3,000 posts/min). English, non-reply posts that read as design talk count mentions of the terms the terminal tracks (`GET /api/public/discourse-terms`; font names match case-sensitively) and of fatigue phrases ("played out", "overdone", …). It posts aggregate counts plus at most 400 design posts (text ≤300 chars, post link, first external link) to `POST /api/public/ingest-wire`. It is a sample of windows, not the full firehose; counts travel with `sampled_posts`. Exits cleanly if the terminal hasn't deployed the endpoints yet.

## Watchdog (`.github/workflows/watchdog.yml`)

Failures become GitHub issues (GitHub emails the repo owner) and close themselves on recovery. Hourly, `src/watchdog.js` polls the terminal's public `/api/public/health`; while it isn't `ok` there is one open issue labelled `health` with the stale/failing jobs (updated only when the table changes). After every run of weekly-crawl, library-crawl, wayback-backfill, render-queue and discourse-sampler, a failure opens (or keeps) one `workflow-failure` issue per workflow; the next success closes it. Uses the built-in `GITHUB_TOKEN`; no extra secrets.

## Library replacements (Nov 2026)

27 sites that blocked the crawler (403/429/bot walls, no live capture in 5+ days) were swapped for same-sector peers that passed a robots + render probe with the crawler's own code. Removed sites are deactivated by `library_sync`, so their history stays.

## Digest thumbnails

The Saturday full library run (`LIBRARY_MODE=full`) also captures one small above-the-fold crop per live homepage, desktop and mobile, for The Digest. This is the only image the project stores. The policy is small crops that are credited and linked to the site, and removable on request.

- **What's captured:** the visible viewport only, never the full page. It is downscaled to fit 1280×800, or 1024 or 800 wide when a busy page won't fit, and encoded as WebP of at most 150 KB, plus 640w and 320w variants. Code: `src/thumbs.js`.
- **Where it goes:** batches of up to 12 captures per request, under 4 MB, are posted to `/api/public/ingest-thumbs` with `x-crawl-secret`. The server validates them, refuses opted-out domains, and keeps the latest 2 per domain and viewport.
- **robots.txt:** checked before the page loads, the same check as every snapshot.
- **Turning it off:** set `THUMBS=0`. Dry runs count captures without posting.
- **Opt-outs:** `POST /api/public/thumb-optout` with `{"domain":"example.com","note":"owner request"}` and the same secret header. This deletes the site's stored captures and refuses future ones. Send `"action":"remove"` to lift the opt-out.
