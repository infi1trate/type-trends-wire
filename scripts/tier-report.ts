// Prints tier counts (scope all), the headline list and the composites from the latest stored forecast. Read-only.
//   bun scripts/tier-report.ts
import { latestSignals } from "../src/lib/signals.server";
import { tierCounts } from "../src/lib/tiers";
import { COMPOSITES } from "../src/lib/composites";
const { snap, tiers, signals } = await latestSignals("all");
console.log("run", snap.run_id, "prev", snap.prev_runs.join(","), "counts (forecast rows + composites)", tierCounts(tiers));
const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
console.log("\nHEADLINE");
for (const s of signals.filter(s => s.tier === "headline").sort((a, b) => (b.momentum_index ?? -1) - (a.momentum_index ?? -1))) console.log(`${s.name} [${s.dimension}] · ${s.basis} · ${pct(s.share)} · ${s.stage ?? "—"} · M ${s.momentum_index ?? "—"} ${s.direction ?? ""} · ${s.confidence_reason}`);
console.log("\nCOMPOSITES");
for (const c of COMPOSITES) { const s = signals.find(x => x.key === c.key); const t = tiers.get(c.key); console.log(`${c.name} [${c.dimension}] · ${t?.tier} · ${pct(s?.share ?? null)} · ${s?.stage ?? "—"} · M ${s?.momentum_index ?? "—"} ${s?.direction ?? ""} · ${s?.confidence_reason ?? "no row"} · ${t?.reasons.slice(1).join(" ")}`); }
console.log("\nSUPPORTING (forecast rows)");
for (const s of signals.filter(s => s.tier === "supporting")) console.log(`${s.name} · ${tiers.get(s.key)?.reasons.slice(1).join(" ")}`);
