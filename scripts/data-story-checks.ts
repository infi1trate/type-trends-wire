// Runs the four data story "is there a story" checks against stored data and prints their figures (bun scripts/data-story-checks.ts). Read-only.
import { dataInput } from "@/lib/data-stories/data.server";
import { softwareFigures, softwareVerdict, bigTypeFigures, bigTypeVerdict, fintechFigures, fintechVerdict, sectorMindsFigures, sectorMindsVerdict } from "@/lib/data-stories/checks";
import { compositeSeries, quarterCoverage } from "@/lib/data-stories/series";
const i = await dataInput();
console.log("rows", i.history.length, "snaps", i.snaps.length, "events", i.events.length, "rebrands", i.rebrands.length, "headline", i.headline.length, "sample q", i.history[0]?.quarter);
const a = softwareFigures(i); console.log("A", JSON.stringify(a), JSON.stringify(softwareVerdict(a)));
console.log(JSON.stringify(compositeSeries(i, ["dev-tools","enterprise-saas"]).map(s => [s.key, s.points.map(p => `${p.q}:${(p.share*100).toFixed(1)}/${p.denom}`)])));
console.log("cov", JSON.stringify(quarterCoverage(i, ["dev-tools","enterprise-saas"]).filter(c=>c.usable)));
const b = bigTypeFigures(i); console.log("B", JSON.stringify(b), JSON.stringify(bigTypeVerdict(b)));
const c = fintechFigures(i); console.log("C", JSON.stringify(c), JSON.stringify(fintechVerdict(c)));
const d = sectorMindsFigures(i); console.log("D", JSON.stringify(d), JSON.stringify(sectorMindsVerdict(d)));
