# Y1 + Y2 · proof

- Y1: platform dates (16 rows, MDN links; `css:anchor_positioning` Firefox and all-three dates unknown, null), rule-matched dossiers in four drawers, timing test, evidence desk in the weekly structure follow-up (no new cron). First run: 67 dossiers, 6 Platform, 0 Business, 51 Culture, 7 Calendar, 0 model-proposed.
- Y2: Why-now writer is its own version (`why`) in golden/versions.ts and its own ledger kind (`why_now`). It has no score yet, so the golden-gate test is red for it as for the story writer, and `writeWhyNow` refuses to call. Ten frozen examples: `src/lib/evidence/__fixtures__/why-now-set.json` (3 pass, 7 refused by the checks).
- No blocks are stored yet, so no reader page shows the block. Backfill: `bun scripts/why-now-backfill.ts` after both writers are scored.
- Migration: `migration.sql`.
