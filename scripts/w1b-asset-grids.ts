// W1b · measure every stored icon and card that has no colour grid yet (the sweep's path, without its time cap), then print the verdict
// for each brand with two or more versions. Usage: bun scripts/w1b-asset-grids.ts
const { measurePendingAssets, assetHistory } = await import("../src/lib/asset-changes.server");
console.log(JSON.stringify(await measurePendingAssets({ limitMs: 240_000 })));
const h = await assetHistory();
for (const c of h.comparisons) console.log(JSON.stringify({ domain: c.domain, kind: c.kind, verdict: c.verdict, reason: c.reason, old: [c.from.first_seen_at.slice(0, 16), c.from.last_seen_at.slice(0, 16)], new: [c.to.first_seen_at.slice(0, 16), c.to.last_seen_at.slice(0, 16)] }));
process.exit(0);
