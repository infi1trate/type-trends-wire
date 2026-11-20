// Writes every precomputed page record now (P1), the same way the scheduled sweeper does, without a call budget.
// Writes only `read_records` (a derived, rebuildable table); never touches source rows.
// Usage: bun scripts/refresh-records.ts            (everything due)
//        bun scripts/refresh-records.ts --force    (everything)
const { refreshRecords } = await import("../src/lib/records/refresh.server");
const force = process.argv.includes("--force"), t0 = Date.now();
const r = await refreshRecords({ job: "script", deadline: Date.now() + 30 * 60_000, force });
console.log(JSON.stringify({ written: r.written.length, kinds: Object.fromEntries([...new Set(r.written.map(k => k.split(":")[0]))].map(k => [k, r.written.filter(x => x.split(":")[0] === k).length])), skipped: r.skipped, timed_out: r.timed_out, errors: r.errors.slice(0, 20), ms: Date.now() - t0 }, null, 1));
process.exit(0);
