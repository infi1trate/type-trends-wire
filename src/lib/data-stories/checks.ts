// "IS THERE A STORY?" — one small check per candidate, with named thresholds, run against stored data before a story goes live. Pure.
// Each check is split into figures (measured from the data) and a verdict (figures against thresholds) so both sides can be tested.
import { compositeSeries, activeSites, usableCaptures, usableQuarters, rowsIn, snapIndex, sectorOfSite, type DataInput } from "./series";
import { adoption } from "./templates/adoption";
import { compositeKey } from "../composites";
import { label } from "../labels";
import { SECTORS } from "../library";
import { museumFigures, museumVerdictText, type MuseumFigures } from "./museum";
import { SHOW_MIN_GROUPS, SHOW_MIN_WORKS, STUDY_MIN_SECTORS } from "../art/palette";
import { STUDY_MIN_ACCENTS, STUDY_MIN_WORKS } from "../art/accent";
import { accentStudyFigures, type AccentStudyFigures } from "./museum-accent";

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
export function adoptionOf(i: DataInput, key: string = BIG_TYPE.key, name = label(key).name) {
  return adoption({ signal: { key, name }, sites: activeSites(i, null), rows: rowsIn(i, null), usable: usableQuarters(i, null), share: [], title: "", note: "" });
}
/** E4 · the study 2 check run on another signal: how many adopters have an established first quarter (needs BIG_TYPE.minEntries). */
export const adoptionEntries = (i: DataInput, key: string, name: string) => adoptionOf(i, key, name).entries.length;
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

/** E4 · what a study that is not live is waiting for, from its check's figures: have, need, and one plain sentence. */
export type Wait = { have: number; need: number; text: string; /** One new well-covered quarter per calendar quarter closes the gap. */ perQuarter: boolean };
export function waitOf(id: CheckId, i: DataInput): Wait {
  switch (id) {
    case "software": { const f = softwareFigures(i); return { have: f.moved, need: SOFTWARE.minMoved, text: `Has ${f.moved} composite signals that moved ${SOFTWARE.movePts * 100} points, needs ${SOFTWARE.minMoved}.`, perQuarter: false }; }
    case "big-type": { const f = bigTypeFigures(i); return { have: f.entries, need: BIG_TYPE.minEntries, text: `Has ${f.entries} dated adopters, needs ${BIG_TYPE.minEntries}.`, perQuarter: false }; }
    case "fintech-colour": { const f = fintechFigures(i); return { have: f.quarters, need: FINTECH_COLOUR.minQuarters, text: `Has ${f.quarters} well-covered quarters of fintech palettes, needs ${FINTECH_COLOUR.minQuarters}.`, perQuarter: true }; }
    case "museum": { const f = museumFigures(i); return f.ready ? { have: f.sectors, need: STUDY_MIN_SECTORS, text: museumVerdictText(f), perQuarter: false } : { have: f.works, need: SHOW_MIN_WORKS, text: museumVerdictText(f), perQuarter: false }; }
    case "museum-accent": { const f = accentStudyFigures(i); return f.vivid < STUDY_MIN_ACCENTS ? { have: f.vivid, need: STUDY_MIN_ACCENTS, text: accentWaitText(f), perQuarter: false } : { have: f.works, need: STUDY_MIN_WORKS, text: accentWaitText(f), perQuarter: false }; }
    case "sector-minds": { const f = sectorMindsFigures(i); return { have: f.sectors, need: SECTOR_MINDS.minSectors, text: `Has ${f.sectors} sectors with ${SECTOR_MINDS.minEvents} dated changes, needs ${SECTOR_MINDS.minSectors}.`, perQuarter: false }; }
  }
}
export const CHECKS = {
  software: (i: DataInput) => softwareVerdict(softwareFigures(i)),
  "big-type": (i: DataInput) => bigTypeVerdict(bigTypeFigures(i)),
  "fintech-colour": (i: DataInput) => fintechVerdict(fintechFigures(i)),
  "sector-minds": (i: DataInput) => sectorMindsVerdict(sectorMindsFigures(i)),
  museum: (i: DataInput) => museumVerdict(museumFigures(i)),
  "museum-accent": (i: DataInput) => museumAccentVerdict(accentStudyFigures(i)),
} as const;
// W3c · brand colours the museum works hold: enough vivid accents and enough stored works, and the headline's numbers recomputed from
// stored data must be the numbers the rule writes (a headline that does not match the stored counts fails the study).
export const museumAccentVerdict = (f: Pick<AccentStudyFigures, "vivid" | "works" | "headline">) => verdict([
  { id: "accents", label: "Tracked brands with a vivid accent", value: f.vivid, need: STUDY_MIN_ACCENTS },
  { id: "works", label: "Public-domain works stored", value: f.works, need: STUDY_MIN_WORKS },
  { id: "headline", label: "Headline numbers are the stored numbers", value: f.headline, need: 1 },
], x => (x.id === "accents" ? `Only ${x.value} tracked brands have a vivid accent (needs ${x.need}).` : x.id === "works" ? `Only ${x.value} public-domain works are stored (needs ${x.need}).` : "The headline's numbers are not the stored numbers."));
export const accentWaitText = (f: Pick<AccentStudyFigures, "vivid" | "works">) => `Has ${f.vivid} brands with a vivid accent (needs ${STUDY_MIN_ACCENTS}) and ${f.works} public-domain works (needs ${STUDY_MIN_WORKS}).`;
export type CheckId = keyof typeof CHECKS;

// W3a · nearest in the museum: enough stored public-domain works, in enough groups of fifteen. W3b · and enough sectors that name a
// group under the comparable-palette rules: a sector-level claim on two to five homepages is not a finding.
export const museumVerdict = (f: Pick<MuseumFigures, "works" | "groups" | "sectors">) => verdict([
  { id: "works", label: "Public-domain works stored", value: f.works, need: SHOW_MIN_WORKS },
  { id: "groups", label: "Groups of fifteen works or more", value: f.groups, need: SHOW_MIN_GROUPS },
  { id: "sectors", label: "Sectors that name a museum group", value: f.sectors, need: STUDY_MIN_SECTORS },
], x => x.id === "works" ? `Has ${x.value} works, needs ${x.need}.` : x.id === "groups" ? `Has ${x.value} groups, needs ${x.need}.` : `Not enough for a finding: ${x.value} sectors name a museum group, needs ${x.need}.`);
