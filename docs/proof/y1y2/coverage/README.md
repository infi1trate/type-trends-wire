# Y1/Y2 · Calendar evidence coverage correction

## Rule and drawer audit

Reader share charts and evidence now take their thresholds from `forecast.THRESHOLDS`: at least 15 homepages and 25% coverage. Dossiers receive the stored forecast run's `evidence.quarters` including `n` and `c`, exactly as the charts do. Missing coverage is unusable, not implicitly covered. Calendar requires at least two earlier same-season quarters and two other quarters passing this shared rule. No new threshold was introduced.

| Drawer / calculation | Before | Now |
| --- | --- | --- |
| Calendar | Non-null share and n ≥15; ignored c | Non-null finite share, n ≥15 and c ≥25%; unknown c refused; two earlier same-season and two other eligible quarters |
| Platform | Verified MDN browser dates; independent weekly download counts crossing twice their earliest stored week | Unchanged; neither is derived from quarterly homepage shares |
| Business | Dated outlet items naming currently present brands; AI-assistant/agent keyword rule for `furn:ask_ai` | Unchanged; no quarterly-share calculation |
| Culture | Dated outlet keyword matches; model proposals require a quoted match in the item | Unchanged; no quarterly-share calculation |
| Timing shared by all drawers | n ≥15 and c ≥25%, but missing c accepted | Same chart gate, with missing c refused; rise start and peak ignore thin quarters |
| Momentum / first seen | `buildDossier` computes neither. Momentum figures come from the stored forecast; platform “first shipped” is a verified MDN date, not archive first sighting | Unchanged; forecast already filters by denominator and coverage |

The writer brief, schema, and serialized writer input shape did not change. Prompt fingerprint remains `9298a0aa`; its golden gate passes. No scoring or writer calls were made.

## Stored correction

Executed `bun scripts/evidence-recheck.ts` at 2026-11-26 02:20 UTC. This rebuilds every stored signal-keyed dossier, including those used by studies, and runs the existing `checkWhyNow` against every stored block. No hand-edited rows, migration, or schema statements.

- 67 dossiers rebuilt; 8 changed.
- 7 calendar entries dropped: brutalist, case-study cards, code blocks, sticky scroll stories, scroll timeline, collage, hand-drawn illustration.
- The eighth changed dossier, immersive 3D, gained two fresh rule-matched wire entries during the rebuild.
- All 3 stored blocks rechecked.

| Block | Before | After |
| --- | --- | --- |
| `components:case_study_cards` (2) | passed | refused — Known maps to no rebuilt dossier entry |
| `imagery:collage` (3) | passed | refused — Known maps to no rebuilt dossier entry |
| `css:starting_style` (1) | passed | passed — no failures; text unchanged |

Persisted writer statuses are `passed` and `refused`; `skipped` is a writer return value, not a stored block status. The table's status column is text without an enum/check; existing public RLS and readers expose only `passed`. The correction updates failing historical rows to `refused` rather than adding a newer refusal that could leave an older passed row visible. Previously refused rows are not silently republished.

Machine-readable counts and failures: `recheck.json`.

## Verification

- Regression fixtures: exact 20 supplied collage denominators, the four earlier Q4 single-brand counts, full-panel seasonal series, minimum comparable quarter counts, unknown/low coverage timing, parity with chart selection, missing-Known withdrawal.
- Targeted checks: 44 passed.
- Full `bunx vitest run`: **2,825 passed, 0 failed, 3 skipped**, 295 files passed.
- Latest preview build: OK.
- Browser: real stored data on all three signal pages; both calendar blocks absent, MDN block visible with unchanged wording. Screenshots reviewed.
- No deployment, schema change, flags, secrets, crawler or workflow changes. No writer/model calls.