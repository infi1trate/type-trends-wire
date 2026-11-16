import { siteTraitIndex } from "@/lib/read.server";
import { latestSignals } from "@/lib/signals.server";
import { similarBrands } from "@/lib/similar";
const [sites, { signals }] = await Promise.all([siteTraitIndex(), latestSignals("all")]);
const eligible = new Set(signals.filter(s => s.tier === "headline" && s.basis === "measured").map(s => s.key));
console.log("eligible", eligible.size, [...eligible].slice(0, 40).join(" "));
for (const min of [0.3, 0.4, 0.5, 0.6, 0.7]) {
  let ge3 = 0, ge6 = 0, zero = 0; for (const s of sites) { const r = similarBrands(s.domain, sites, eligible, { min }); if (r.items.length >= 3) ge3++; if (r.items.length >= 6) ge6++; if (!r.items.length) zero++; }
  console.log(min, "ge3", ge3, "ge6", ge6, "zero", zero, "of", sites.length);
}
const n = similarBrands("neon.com", sites, eligible); console.log(JSON.stringify(n, null, 0).slice(0, 1500));
const sizes = sites.map(s => s.traits.filter(t => eligible.has(t)).length).sort((a,b)=>a-b); console.log("sizes", sizes[0], sizes[75], sizes[150], sizes[225], sizes.at(-1));
process.exit(0);
