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
