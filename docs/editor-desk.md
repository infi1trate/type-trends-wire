# Editor's desk

The story engine writes stories on its own; the desk lets an editor overrule it. Stored stories are never changed:
every action appends one row to `story_edits`, and pages apply the latest edits on top.

- **Read-only view:** `/desk` (inside the site gate) shows the queue for the last 7 days or one day: what ran, what was
  held and why, the four score components and the edit log. Paste the editor key into the password field to show the
  actions; the key stays in that tab's memory only (never stored, never in a URL).
- **Machine endpoint:** `POST /api/public/desk` with `Authorization: Bearer <EDITOR_KEY>`. The editor key is the
  existing crawler shared secret, compared by SHA-256 before the body is read. 30 calls per minute per IP.

Replace `<EDITOR_KEY>` with the key from your password manager. Never paste a real key into docs, issues or chat.

```sh
SITE=https://type-trends-wire.lovable.app
KEY='<EDITOR_KEY>'

# Queue (published + held, scores and reasons); optional "day": "2026-11-16"
curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"action":"queue"}'

# Pin a story to the lead until a time (at most 7 days ahead). Pinning a held story runs it.
curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"action":"pin","id":"white:fintech:2026-W47","until":"2026-11-18T09:00:00Z","note":"Monday lead"}'

# Kill a story (it disappears from every page; its own URL says it was taken down and why)
curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"action":"kill","id":"news:1234","reason":"Not about the tracked brand"}'

# Correct the headline, deck and/or why-it-matters line (the story then shows "Corrected <date>")
curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"action":"correct","id":"move:214","headline":"apple.com changed its palette"}'

# Restore a killed story, or run a held one anyway
curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  -d '{"action":"restore","id":"roundup:fintech:palette_shift:1483"}'
```

Responses: `201 {ok, edit}` for writes, `200` for the queue, `401` without a valid key, `404` for an unknown story,
`400` for invalid input (past or too-distant pins, empty corrections, a `$` in corrected text), `429` when rate limited.
