import { siteTraitIndex } from "@/lib/read.server";
import { latestSignals } from "@/lib/signals.server";
import { jaccard, comparable } from "@/lib/similar";
const [sites, { signals }] = await Promise.all([siteTraitIndex(), latestSignals("all")]);
const el = new Set(signals.filter(s => s.tier === "headline" && s.basis === "measured").map(s => s.key));
for (const [min, sh] of [[0.6,1],[0.6,2],[0.5,2],[0.75,2]] as const) { let ge3 = 0;
  for (const s of sites) { const m = comparable(s.traits, el); const n = sites.filter(o => o.domain !== s.domain).filter(o => { const t = comparable(o.traits, el); const shared = [...m].filter(k => t.has(k)).length; return shared >= sh && jaccard(m, t) >= min; }).length; if (n >= 3) ge3++; }
  console.log(min, sh, ge3); }
const dist = new Map<number, number>(); for (const s of sites) { const n = comparable(s.traits, el).size; dist.set(n, (dist.get(n) ?? 0) + 1); } console.log([...dist].sort());
process.exit(0);
