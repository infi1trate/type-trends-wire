# Section crops (Phase 15)

Small, credited crops of named sections of each tracked brand's desktop homepage, kept over time so pages can show
evidence (brand Sections strip and history, before/after on moves and rebrands, pattern example grids).
The crawler (in `crawler/`, owned separately) takes the crops; this app validates, stores and serves them.

## Ingest: `POST /api/public/ingest-crops`

Headers: `x-crawl-secret: <crawler secret>` (same SHA-256 check as `/api/public/ingest-thumbs`), `content-type: application/json`.
The secret is checked before the body is read. Body ≤ 4 MB (4 × 1024 × 1024 bytes).

```json
{
  "run_id": "string, 1–80 chars",
  "captures": [
    {
      "domain": "vercel.com",
      "section": "hero | nav | pricing | cta | footer",
      "viewport": "desktop",
      "captured_at": "2026-11-15T06:00:00Z",
      "width": 1280,
      "height": 800,
      "hash": "hex, 16–64 chars (perceptual hash of the crop; stored lowercased)",
      "webp_base64": "base64 WebP, decoded ≤ 150 KB (153 600 bytes)"
    }
  ]
}
```

- 1–12 captures per request. Unknown keys are rejected (strict objects).
- `captured_at` must be ISO 8601 with a timezone (`Z` or an offset).
- `width` integer 1–1280, `height` integer 1–1600, and they must equal the WebP header's canvas size.
- `domain` is lowercased; it must be an active library site.

### Responses

| Status | Body |
| --- | --- |
| 200 | `{ "stored": n, "unchanged": n, "refused": [ { "domain": "…", "section": "…", "reason": "…" } ] }` |
| 400 | `{ "error": "<plain reason>" }`, e.g. `"Body is not valid JSON"` or `captures.0.section: unknown section "logo" (expected hero, nav, pricing, cta, footer)` |
| 401 | `{ "error": "Missing or wrong x-crawl-secret" }` |
| 413 | `{ "error": "Body exceeds 4 MB" }` |
| 500 | `{ "error": "Internal error" }` (nothing about the payload is logged) |

Body-level problems (bad JSON, schema, unknown section, wrong counts, dimensions over the limits) fail the whole request with 400.
Per-capture problems are reported in `refused` and the rest of the batch still goes through. Refusal reasons:

- `opted_out` — the domain is in `thumb_optouts`.
- `untracked_domain` — not an active library site.
- `over_150kb` — decoded image larger than 150 KB.
- `not_webp` — not a RIFF/WEBP file.
- `bad_webp` — a WebP header whose canvas size can't be read.
- `too_large_dimensions` — the header is bigger than 1280×1600.
- `dimension_mismatch` — header size differs from the declared `width`/`height`.

## Storage and the history rule

- Private bucket `site-crops`; object path `<domain>/<section>/<yyyy-mm-dd>-<first 8 of hash>.webp` (UTC day of `captured_at`).
- Table `site_crops`: domain, section, viewport, captured_at, first_seen_at, last_seen_at, path (unique), width, height, bytes, hash, run_id.
- If the newest stored version of that domain + section + viewport has the same hash (or the same path), no image is stored:
  its `last_seen_at` moves forward to the later of the two dates and the capture counts as `unchanged`.
- Otherwise a new version is stored (`first_seen_at = last_seen_at = captured_at`).
- At most 12 versions per domain + section + viewport: when a 13th arrives, the oldest version's object and row are deleted.

## Serving: `GET /crops/<path>`

- Behind the site password gate like any page (not in `OPEN_PATHS`; never in link previews or search engines).
- Served only while a `site_crops` row exists for the path and the domain has not opted out; otherwise 404.
- `Cache-Control: private, max-age=604800, immutable` (paths are content-addressed), `X-Robots-Tag: noindex`.

## Opt-out

- Opt-outs live in `thumb_optouts` and cover thumbnails and crops alike.
- `POST /api/public/thumb-optout` with `action: "add"` deletes every stored thumbnail and crop of the domain;
  the response adds `crops_deleted`.
- An opted-out domain is refused at ingest (and by a database trigger on `site_crops`), and its crops are never served
  (row policy hides them and `/crops` checks the opt-out list again).
- Every image shows its section, domain and capture date, links to the live site, and has a "Report this image" link to the
  removal policy on /what-we-show.

## How pages use crops

- Brand page: latest crop of each section, each opening its full history (newest first).
- Before/after (brand timeline, MOVE / COUNTER-MOVE / REBRAND stories): before = newest version captured before the change
  minus 12 hours, after = earliest version at or after that; shown only when both exist and their hashes differ.
  Which section fits a change: `changeSection` / `storySection` in `src/lib/evidence-map.ts`.
- Pattern pages: the section from `patternSection(key)`; an example shows a crop only if it was last seen within 14 days of
  the brand's measurement. A pattern is "illustrated" from 3 examples with captures.
- ROUNDUP stories: member brands' current hero crops (up to 8).
