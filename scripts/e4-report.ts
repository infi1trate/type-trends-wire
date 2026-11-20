// E4 · prints the headline numbers of each live study (before/after the truth rules) from stored data. Read-only.
// Usage: bun scripts/e4-report.ts
import { dataInput } from "@/lib/data-stories/data.server";
import { softwareFigures, bigTypeFigures, sectorMindsFigures, fintechFigures } from "@/lib/data-stories/checks";
import { sectorRates, mindsBrand } from "@/lib/data-stories/stories";
const i = await dataInput();
const sf = softwareFigures(i), bt = bigTypeFigures(i), sm = sectorMindsFigures(i), ft = fintechFigures(i);
const rates = sectorRates(i).filter(r => r.pairs).map(r => ({ s: r.s, events: r.events, pairs: r.pairs, per100: +(100 * r.rate).toFixed(1) })).sort((a, b) => b.per100 - a.per100 || a.s.localeCompare(b.s));
const d = mindsBrand(i);
console.log(JSON.stringify({
  events: i.events.length, live: i.events.filter(e => e.source === "live").length, wayback: i.events.filter(e => e.source === "wayback").length,
  study1: { moved: sf.moved, movedKeys: sf.movedKeys, topBrands: sf.topBrands, marks: Object.fromEntries(sf.topBrands.map(t => [t.domain, i.events.filter(e => e.domain === t.domain).length])) },
  study2: bt, study3: { quarters: ft.quarters }, study4: { sectorsPassing: sm.sectors, perSector: sm.perSector, rates, most: rates[0], least: rates.at(-1), brand: d, brandCount: d ? i.events.filter(e => e.domain === d).length : null },
}, null, 1));
process.exit(0);
