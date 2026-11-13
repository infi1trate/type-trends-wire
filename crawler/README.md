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

## Wayback history (`LIBRARY_MODE=wayback`)

`.github/workflows/wayback.yml` (manual) backfills each library homepage from the Wayback Machine: one archived capture per half-year since `FROM_YEAR` (default 2021), the one nearest the half's midpoint, rendered through `web.archive.org/web/{ts}if_/…` at desktop size and posted as `source: "wayback"` snapshots (captured_at = archive time, `signals.archive = {timestamp, wayback_url, bucket}`), then tagged like live homepages. One job per sector, two at a time, 2.5 s between archive loads. Halves already stored are skipped, so re-running fills gaps only. The current half-year is left to live crawls. Archived pages sometimes miss fonts or assets; the terminal flags low-coverage buckets.
