# Editor's desk

The story engine writes stories on its own; the desk lets an editor (and, later, the newsroom's desks) overrule it. Stored stories
are never changed: every story action appends one row to `story_edits`, and pages apply the latest edits on top.

- **Staff page:** `/desk` shows the queue for the last 7 days or one day (what ran, what was held and why, the score components,
  each story's state history and the edits), the pitches, spend against the weekly cap, every action with its level, the desk
  log with a desk filter, the board and the golden scores. Paste the editor key to open it; the key stays in that tab's memory
  only (never stored, never in a URL). The page acts as `owner`.
- **Machine endpoint:** `POST /api/public/desk` with `Authorization: Bearer <EDITOR_KEY>`. The editor key is the existing crawler
  shared secret, compared by SHA-256 before the body is read. 30 calls per minute per IP.

Replace `<EDITOR_KEY>` with the key from your password manager. Never paste a real key into docs, issues or chat.

## The door (N1)

Every call carries an **`actor`**: one of the desks (`editor in chief`, `copy desk`, `standards`, `news`, `data`, `graphics`,
`design review`, `engineering`, `publisher`, `scout`) or `owner`. A call without one is refused (`400 actor_required`).

Each action has a **level** (the register lives in `src/lib/newsroom/register.ts`):

| Level | What happens |
|---|---|
| Ships alone | Runs. |
| Ships to preview | Recorded in the desk log as a proposal (`202`); nothing live changes. |
| Needs the owner | Refused (`403`) unless `actor` is `owner` and the call carries `"confirm": "owner confirms <action>"`. |

While the owner's weekly cap is reached, an action that costs money is refused (`403`), and the three writers make no model calls.

**Every authenticated call is logged** in the desk log (append-only): time, actor, action, level, subject, decision (`done`,
`read`, `proposed`, `refused`, `failed`) and reason. Kills, holds, retirements and refusals always carry a reason. Calls without
a valid key, and rate-limited calls, are answered before the body is read and are not logged: they carry no actor, and logging
them would let anyone write to the table.

| Action | Level | Body (besides `actor`) |
|---|---|---|
| `check` | ships alone | — |
| `staff` | ships alone | `page`: `status`, `launch` or `welcome` |
| `queue` | ships alone | optional `day` (`YYYY-MM-DD`) |
| `memory` | ships alone | — (everything a desk session needs, under 200 KB) |
| `newsroom` | ships alone | optional `desk` (filters the log) |
| `pin` | ships alone | `id`, `until` (ISO time, at most 7 days ahead), optional `note` |
| `kill` | ships alone | `id`, `reason`, optional `note` |
| `correct` | ships alone | `id`, one or more of `headline`, `deck`, `why_line`, optional `note` |
| `restore` | ships alone | `id`, optional `note` |
| `pitch` | ships alone | `kind`, `ref`, `facts`, `note` |
| `assign` | ships alone | `pitch` (id), `desk`, `status` (`open`, `assigned`, `working`, `done`, `dropped`), `reason` (required for `dropped`) |
| `spend` | ships alone | `credits` (Lovable build credits), `what` |
| `propose` | ships to preview | `kind` (`chart`, `study_series`, `layout`, `signal`, `format`, `design_edition`), `text`, optional `subject` |
| `living_approve` | needs the owner | `edition`, optional `note` |
| `living_rollback` | needs the owner | `edition`, optional `note` |
| `wire_only` | needs the owner | `on` (true or false), `reason` |
| `spend_cap` | needs the owner | `model_usd` (or null), `build_credits` (or null), `reason`; both null clears the cap |

## Examples

```sh
SITE=https://slug.global
KEY='<EDITOR_KEY>'
desk() { curl -s -X POST "$SITE/api/public/desk" -H "Authorization: Bearer $KEY" -H 'content-type: application/json' -d "$1"; }

# A desk session starts by reading the memory
desk '{"actor":"copy desk","action":"memory"}'

# Queue (published + held, scores, reasons and states); optional "day": "2026-11-16"
desk '{"actor":"editor in chief","action":"queue"}'

# Pin a story to the lead (at most 7 days ahead). Pinning a held story runs it.
desk '{"actor":"editor in chief","action":"pin","id":"white:fintech:2026-W47","until":"2026-11-18T09:00:00Z","note":"Monday lead"}'

# Kill a story (its own URL says it was taken down and why)
desk '{"actor":"standards","action":"kill","id":"news:1234","reason":"Not about the tracked brand"}'

# Correct the headline (the story then shows "Corrected <date>")
desk '{"actor":"copy desk","action":"correct","id":"move:214","headline":"Apple changed its palette"}'

# Restore a killed story, or run a held one anyway
desk '{"actor":"editor in chief","action":"restore","id":"roundup:fintech:palette_shift:1483"}'

# Put a pitch on the board
desk '{"actor":"data","action":"assign","pitch":12,"desk":"data","status":"working"}'

# Record build spend (the product cannot read its own build costs)
desk '{"actor":"engineering","action":"spend","credits":40,"what":"N1 newsroom foundations"}'

# Propose a format change: recorded, nothing live changes
desk '{"actor":"graphics","action":"propose","kind":"chart","text":"A slope chart for two-quarter comparisons"}'

# Owner only, with the confirmation phrase
desk '{"actor":"owner","confirm":"owner confirms spend_cap","action":"spend_cap","model_usd":25,"build_credits":null,"reason":"Weekly cap from December"}'
desk '{"actor":"owner","confirm":"owner confirms wire_only","action":"wire_only","on":false,"reason":"Back to stories"}'
```

Responses: `200` for reads, `201` for writes, `202` for proposals, `400` for invalid input or a missing actor, `401` without a
valid key, `403` when the door refuses (with `reason`, and `confirm` naming the phrase when the owner's confirmation is missing),
`404` for an unknown story or pitch, `409` when the design gate refuses an edition, `413` for a body over 8 KB, `429` when rate
limited.
