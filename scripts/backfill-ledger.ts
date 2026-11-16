// One-time: write forecast_calls for the stored ok runs that still exist (marked backfilled), then resolve. Idempotent:
// the first call per (week, trait, scope) stands, so rerunning writes nothing new.
//   bun scripts/backfill-ledger.ts
import { backfillLedger } from "../src/lib/ledger/store.server";
const r = await backfillLedger();
for (const x of r.runs) console.log(`run ${x.run_id}: selected ${x.selected}, written ${x.written}`);
console.log(`total written ${r.runs.reduce((s, x) => s + x.written, 0)} · resolution checked ${r.resolution.checked}, resolved ${r.resolution.resolved}`);
