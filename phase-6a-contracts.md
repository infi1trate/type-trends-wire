# Phase 6A — Wayback request contracts

## Snapshot ingestion
`POST /api/public/ingest-crawl`, existing `x-crawl-secret` header.
```json
{
  "kind": "library_snapshots",
  "run_id": "wayback-2026",
  "snapshots": [{
    "domain": "anthropic.com",
    "page_type": "home",
    "viewport": "desktop",
    "source": "wayback",
    "captured_at": "2021-07-15T12:30:00Z",
    "url": "https://anthropic.com/",
    "html_hash": "<hash>",
    "content_hash": "<hash>",
    "signals_hash": "<hash>",
    "signals": {
      "archive": {
        "timestamp": "20210715123000",
        "wayback_url": "https://web.archive.org/web/20210715123000if_/https://anthropic.com/"
      },
      "type": {}, "color": {}, "layout": {}, "composition": {},
      "lexicon": {}, "tech": {}, "css_features": [], "skeleton": []
    }
  }]
}
```
`run_id` is optional; batches contain 1–25 snapshots. Existing signals remain passthrough. Hashes are optional/nullable. `captured_at` is the archive UTC capture time; `url` is original, not replay URL. Do not send `raw_text` for archives; archive text is not stored or queued.
Response: `{ "ok": true, "inserted": 1, "events": 0 }`; duplicates insert zero. Historical batches should be sent oldest-first per domain; sorting is enforced within each batch. Captures older than an already advanced baseline are stored but require existing history replay to rebuild measured events.

## Tagging
`POST /api/public/library-tag`, existing `x-crawl-secret` header.
```json
{
  "domain": "anthropic.com",
  "page_type": "home",
  "viewport": "desktop",
  "source": "wayback",
  "captured_at": "2021-07-15T12:30:00Z",
  "signals_hash": "<same snapshot hash>",
  "images": {
    "fold": "data:image/jpeg;base64,<JPEG>",
    "sections": ["data:image/jpeg;base64,<JPEG>"]
  }
}
```
`source` is optional and defaults to `live`. `sections` is optional, 0–4 JPEGs, ≥200×200 and ≤600 KiB decoded each. Optional legacy `page` JPEG is retained; nonempty sections replace it. All images ≥200×200; complete body ≤2 MiB. Match snapshot source/time/hash exactly. Reuse only same domain/hash/source with reliable tags younger than 60 days. Images are never persisted by this app.
Response: `{ "ok": true, "reused": false, "tags": { ...validated tags including blocked_reason and low_confidence... } }`.

## State
`GET /api/public/library-state`, existing `x-crawl-secret` header.
```json
{
  "sites": [{
    "domain": "anthropic.com",
    "sector": "ai",
    "active": true,
    "pages": {},
    "latest": {
      "home:desktop": {
        "html_hash": "<hash or null>",
        "content_hash": "<hash or null>",
        "signals_hash": "<hash or null>",
        "captured_at": "2026-11-12T12:30:00+00:00"
      }
    },
    "wayback": ["2021-07-15T12:30:00+00:00"]
  }]
}
```
Only active sites; latest remains live-only. `wayback` always an array, ascending desktop/home archive capture timestamps. No text or images.

## History reads and verification
- `library_history({metric?, dimension?, value?, sector?})`: metrics use the signal column names; dimension accepts css, fonts, imagery, aesthetic, components, hero_layout, ai_positioning, tone, color_mood. Sector supports all or any Library sector. Font series is overall with h1/body roles. Metric selection returns bucket/sector/metric/value/sites/coverage/low_coverage; other selections return the requested rows and receipts.
- Public canonical series views plus private materializations/public *_history facades. Transactional dirty flag and service-role refresh after snapshot batches and tags. Missing buckets remain null, coverage below 0.30 flagged, not hidden.
- 246 tests passed. State for 300 sites: 639 ms cold, 191–213 ms warm, including request overhead.
- Temporary archive fixtures exercised real store RPCs, measured theme/type and AI imagery/aesthetic historical events, zero extraction jobs; archive selector and MCP call succeeded. Fixtures and their baselines/events/tags removed afterward; no paid AI call was made.
- No existing Wayback captures: crawler backfill itself was not run. Current charts show live values; historical deltas stay unknown until 2021 data arrives.
- Charts/legend and archive selection checked in browser; no page overflow at 360/768/1024/1440. MCP manifest has nine tools. Nothing published; republish to serve the new MCP revision.
