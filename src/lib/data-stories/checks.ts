// "IS THERE A STORY?" — one small check per candidate, with named thresholds, run against stored data before a story goes live. Pure.
// Each check is split into figures (measured from the data) and a verdict (figures against thresholds) so both sides can be tested.
import { compositeSeries, activeSites, usableCaptures, usableQuarters, rowsIn, snapIndex, sectorOfSite, type DataInput } from "./series";
import { adoption } from "./templates/adoption";
import { compositeKey } from "../composites";
import { label } from "../labels";
import { SECTORS } from "../library";

export const SOFTWARE = { sectors: ["dev-tools", "enterprise-saas"] as const, movePts: 0.05, minMoved: 3, minCaptures: 6, minBrands: 2 } as const;
export const BIG_TYPE = { key: compositeKey("big_type"), minEntries: 25 } as const;
export const FINTECH_COLOUR = { sector: "fintech", minQuarters: 8, minBrands: 15 } as const;
export const SECTOR_MINDS = { minEvents: 10, minSectors: 6 } as const;

export type Figure = { id: string; label: string; value: number; need: number };
export type Verdict = { pass: boolean; figures: Figure[]; reason: string | null };
const verdict = (figures: Figure[], reasons: (f: Figure) => string): Verdict => {
  const short = figures.filter(f => f.value < f.need);
  return { pass: !short.length, figures, reason: short.length ? short.map(reasons).join(" ") : null };
};

// a. What happened to the software homepage in five years?
export type SoftwareFigures = { moved: number; movedKeys: string[]; quarters: number; brandsWithCaptures: number; topBrands: { domain: string; captures: number }[] };
export function softwareFigures(i: DataInput): SoftwareFigures {
  const sectors = [...SOFTWARE.sectors], series = compositeSeries(i, sectors);
  const movedKeys = series.filter(s => s.points.length >= 2 && Math.abs(s.points.at(-1)!.share - s.points[0]!.share) >= SOFTWARE.movePts).map(s => s.key);
  const snaps = snapIndex(i);
  const counts = activeSites(i, sectors).map(s => ({ domain: s.domain, captures: usableCaptures(i, s.domain, snaps).length })).sort((a, b) => b.captures - a.captures || a.domain.localeCompare(b.domain));
  return { moved: movedKeys.length, movedKeys, quarters: usableQuarters(i, sectors).length, brandsWithCaptures: counts.filter(c => c.captures >= SOFTWARE.minCaptures).length, topBrands: counts.slice(0, 2) };
}
export const softwareVerdict = (f: Pick<SoftwareFigures, "moved" | "brandsWithCaptures">) => verdict([
  { id: "moved", label: `Composite signals that moved ${SOFTWARE.movePts * 100} points or more over well-covered quarters`, value: f.moved, need: SOFTWARE.minMoved },
  { id: "brands", label: `Brands with ${SOFTWARE.minCaptures} or more usable captures`, value: f.brandsWithCaptures, need: SOFTWARE.minBrands },
], x => (x.id === "moved" ? `Only ${x.value} composite signals moved ${SOFTWARE.movePts * 100} points (needs ${x.need}).` : `Only ${x.value} brands have ${SOFTWARE.minCaptures}+ usable captures (needs ${x.need}).`));

// b. Who went big first?
export type BigTypeFigures = { entries: number; censored: number; adopters: number; never: number; quarters: number };
export function bigTypeFigures(i: DataInput): BigTypeFigures {
  const a = adoptionOf(i);
  return { entries: a.entries.length, censored: a.censored.length, adopters: a.fig.adopters.length, never: a.never.length, quarters: a.fig.quarters.length };
}
export function adoptionOf(i: DataInput) {
  const key = BIG_TYPE.key;
  return adoption({ signal: { key, name: label(key).name }, sites: activeSites(i, null), rows: rowsIn(i, null), usable: usableQuarters(i, null), share: [], title: "", note: "" });
}
export const bigTypeVerdict = (f: Pick<BigTypeFigures, "entries">) => verdict([
  { id: "entries", label: "Adopters whose first-seen quarter is established under the coverage rule", value: f.entries, need: BIG_TYPE.minEntries },
], x => `Only ${x.value} adopters have an established first-seen quarter (needs ${x.need}).`);

// c. Where did fintech's colour go?
export type FintechFigures = { quarters: number; usable: number; perQuarter: { q: string; brands: number }[] };
export function fintechFigures(i: DataInput): FintechFigures {
  const sectors = [FINTECH_COLOUR.sector], usable = usableQuarters(i, sectors), snaps = snapIndex(i), rows = rowsIn(i, sectors);
  const perQuarter = usable.map(q => ({ q, brands: rows.filter(r => r.quarter === q && r.snapshot_id != null && (snaps.get(r.snapshot_id)?.palette.length ?? 0) > 0).length }));
  return { quarters: perQuarter.filter(p => p.brands >= FINTECH_COLOUR.minBrands).length, usable: usable.length, perQuarter };
}
export const fintechVerdict = (f: Pick<FintechFigures, "quarters">) => verdict([
  { id: "quarters", label: `Well-covered quarters with palettes for ${FINTECH_COLOUR.minBrands} or more fintech brands`, value: f.quarters, need: FINTECH_COLOUR.minQuarters },
], x => `Only ${x.value} well-covered quarters have palettes for ${FINTECH_COLOUR.minBrands}+ fintech brands (needs ${x.need}); the archive samples most brands about once a year, in the first quarter, from 2021 to 2024, plus the live crawl now.`);

// d. Which sector changes its mind most?
export type SectorMindsFigures = { sectors: number; perSector: { sector: string; events: number }[]; events: number };
export function sectorMindsFigures(i: DataInput): SectorMindsFigures {
  const sec = sectorOfSite(i), n = new Map<string, number>();
  for (const e of i.events) { const s = sec(e.domain); if (s && e.at) n.set(s, (n.get(s) ?? 0) + 1); }
  const perSector = SECTORS.map(s => ({ sector: s as string, events: n.get(s) ?? 0 })).sort((a, b) => b.events - a.events || a.sector.localeCompare(b.sector));
  return { sectors: perSector.filter(p => p.events >= SECTOR_MINDS.minEvents).length, perSector, events: perSector.reduce((a, p) => a + p.events, 0) };
}
export const sectorMindsVerdict = (f: Pick<SectorMindsFigures, "sectors">) => verdict([
  { id: "sectors", label: `Sectors with ${SECTOR_MINDS.minEvents} or more dated events`, value: f.sectors, need: SECTOR_MINDS.minSectors },
], x => `Only ${x.value} sectors have ${SECTOR_MINDS.minEvents}+ dated events (needs ${x.need}).`);

export const CHECKS = {
  software: (i: DataInput) => softwareVerdict(softwareFigures(i)),
  "big-type": (i: DataInput) => bigTypeVerdict(bigTypeFigures(i)),
  "fintech-colour": (i: DataInput) => fintechVerdict(fintechFigures(i)),
  "sector-minds": (i: DataInput) => sectorMindsVerdict(sectorMindsFigures(i)),
} as const;
export type CheckId = keyof typeof CHECKS;
