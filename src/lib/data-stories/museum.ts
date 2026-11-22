// W3a · Study: which museum group each sector's homepages are nearest to, by palette. Pure over DataInput.art (the stored, not removed,
// public-domain works and every active brand's newest measured palette). Existing chart form only (swatch strips). Hidden from readers
// until the works clear readyToShow (200 works, 8 groups of 15): the registry marks it `hidden` and the check is `museum`.
import type { Figure, Step, StoryModel, Swatch as FigSwatch } from "./types";
import { cap, list, num, ref, sectorHref, dayText } from "./text";
import { model, type Captures, type Meta } from "./stories";
import type { DataInput } from "./series";
import { familyOf } from "./templates/drift";
import { chromatic, distance, groupOf, groups, nearestForSector, readyToShow, GROUP_MIN_WORKS, SHOW_MIN_GROUPS, SHOW_MIN_WORKS, type Colour, type Group, type Swatch, type Work } from "../art/palette";
import { MUSEUM_NAME, type ArtSource } from "../art/contract";
import { sectorName } from "../labels";
import { SECTORS } from "../library";

/** What the museum study reads, loaded beside the other study inputs (absent or empty: the study does not exist for readers). */
export type ArtWorkIn = Work & { link: string; read_at?: string | null };
export type ArtInput = { works: ArtWorkIn[]; brands: { domain: string; sector: string; palette: Swatch[] }[]; through: string | null };
/** At most this many example works per sector row, each credited and linked. */
export const EXAMPLES_PER_SECTOR = 3;
export const MUSEUM_SLUG = "nearest-in-the-museum";

export type MuseumFigures = { works: number; groups: number };
export const museumFigures = (i: Pick<DataInput, "art">): MuseumFigures => { const r = readyToShow(i.art?.works ?? []); return { works: r.works, groups: r.groups }; };
export const museumVerdictText = (f: MuseumFigures) => `Has ${f.works} public-domain works in ${f.groups} groups of ${GROUP_MIN_WORKS}; needs ${SHOW_MIN_WORKS} works and ${SHOW_MIN_GROUPS} groups.`;

const pooled = (palettes: readonly Swatch[][]): FigSwatch[] => {
  const by = new Map<string, FigSwatch>();
  const live = palettes.flatMap(p => { const c = chromatic(p); return c.ok ? [c.colours] : []; });
  for (const cs of live) for (const c of cs) { const id = familyOf(c.hex).id, w = c.w / live.length, x = by.get(id); by.set(id, x ? { id, hex: x.w >= w ? x.hex : c.hex, w: x.w + w } : { id, hex: c.hex, w }); }
  return [...by.values()].sort((a, b) => b.w - a.w).slice(0, 8);
};
const groupSwatches = (g: Group): FigSwatch[] => {
  const by = new Map<string, FigSwatch>();
  for (const c of g.colours) { const id = familyOf(c.hex).id, x = by.get(id); by.set(id, x ? { id, hex: x.w >= c.w ? x.hex : c.hex, w: x.w + c.w } : { id, hex: c.hex, w: c.w }); }
  return [...by.values()].sort((a, b) => b.w - a.w);
};
const credit = (w: ArtWorkIn) => [w.artist, w.title, w.date_display, MUSEUM_NAME[w.source as ArtSource]].filter(x => x && String(x).trim()).join(", ");
/** The group's works nearest the sector's pooled colours (examples on its row), each a credited link to the museum's page. */
function examples(g: Group, works: readonly ArtWorkIn[], sectorColours: readonly Colour[]): ArtWorkIn[] {
  return works.filter(w => groupOf(w).key === g.key).flatMap(w => { const c = chromatic(w.palette); return c.ok ? [{ w, d: distance(sectorColours, c.colours) }] : []; })
    .sort((a, b) => a.d - b.d || `${a.w.source}:${a.w.source_id}`.localeCompare(`${b.w.source}:${b.w.source_id}`)).slice(0, EXAMPLES_PER_SECTOR).map(x => x.w);
}

export function museumStory(i: DataInput, _caps: Captures, m: Meta): StoryModel {
  const art = i.art ?? { works: [], brands: [], through: null }, gs = groups(art.works), href = `/data/${MUSEUM_SLUG}`;
  const active = new Set(i.sites.filter(s => s.active).map(s => s.domain)), brands = art.brands.filter(b => active.has(b.domain));
  const rows = SECTORS.map(s => ({ s, bs: brands.filter(b => b.sector === s) })).filter(r => r.bs.length).map(r => ({ ...r, m: nearestForSector(r.s, r.bs, gs) })).filter(r => r.m.group);
  const bands = rows.flatMap(r => [
    { q: `${sectorName(r.s)} homepages`, brands: r.m.base - r.m.neutral, swatches: pooled(r.bs.map(b => b.palette)) },
    { q: `${sectorName(r.s)}: nearest, ${r.m.group!.name}`, brands: r.m.group!.works, swatches: groupSwatches(r.m.group!) },
  ]);
  const fig: Figure = { kind: "drift", title: "Each sector's homepage colours beside its nearest museum group", rowHead: "Row",
    note: "Upper strip: the sector's homepage colours pooled, neutrals set aside. Lower strip: the group of public-domain works most of its homepages are nearest to. Width is share.", scope: "All sectors", bands };
  const cnt = (v: number, h: string) => num(String(v), v, h);
  const steps: Step[] = [];
  const sources = [...new Set(art.works.map(w => w.source))].length;
  steps.push({ id: "intro", caption: cap`${cnt(art.works.length, href)} public-domain works from ${cnt(sources, href)} museums, in ${cnt(gs.length, href)} groups, against the newest measured palette of ${cnt(brands.length, "/brands")} tracked homepages.`, view: { figure: "drift", highlight: [] } });
  for (const r of rows) {
    const g = r.m.group!, sc = chromatic(r.bs.flatMap(b => b.palette).map(p => ({ hex: p.hex, share: p.share / r.bs.length })));
    const ex = sc.ok ? examples(g, art.works, sc.colours) : [];
    const exSegs = ex.map(w => ref(credit(w), w.link));
    steps.push({ id: `sector-${r.s}`, caption: [
      ...cap`${cnt(r.m.count, sectorHref(r.s))} of ${cnt(r.m.base, sectorHref(r.s))} ${ref(sectorName(r.s), sectorHref(r.s))} homepages are nearest to ${ref(g.name, href)}; ${cnt(r.m.neutral, sectorHref(r.s))} are mostly neutral and have no match.`,
      ...(exSegs.length ? [" Examples: ", ...list(exSegs), "."] : []),
    ], view: { figure: "drift", highlight: [], focus: `${sectorName(r.s)}: nearest, ${g.name}` } });
  }
  steps.push({ id: "caveat", caption: ["Nearest is a measured distance between colours. It says nothing about influence: many old European paintings read mostly dark brown, so their groups sit near any warm, dark palette."], view: { figure: "drift", highlight: [] } });
  const lead = [...rows].sort((a, b) => b.m.count / Math.max(1, b.m.base) - a.m.count / Math.max(1, a.m.base) || a.s.localeCompare(b.s))[0];
  const common = (() => { const c = new Map<string, number>(); for (const r of rows) c.set(r.m.group!.name, (c.get(r.m.group!.name) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]; })();
  const half = Math.ceil(rows.length / 2);
  const date = art.through ? dayText(art.through) : "—";
  return model(m, i, { drift: fig }, steps,
    { brands: brands.length, captures: brands.length, period: date,
      rule: `A palette is up to eight colours a homepage's first screen (or a museum's picture) is made of, each with its share. Near-neutrals (white, grey, black, paper, varnish-dark) are set aside on both sides; the rest are compared in a perceptual colour space, weighted by share. Nearest is the smallest measured distance; it says nothing about influence.`,
      lines: [`${art.works.length} public-domain works (CC0) from The Metropolitan Museum of Art and The Art Institute of Chicago, as stored on ${date}.`, `A group is a movement the museum names, or its department and half-century, read only with ${GROUP_MIN_WORKS} works or more.`] },
    lead ? { n: `${lead.m.count} of ${lead.m.base}`, label: `${sectorName(lead.s)} homepages nearest to ${lead.m.group!.name}` } : { n: "—", label: "homepages nearest to a museum group" },
    { scenes: [
        { id: "intro", lead: "Two museums, every homepage", steps: ["intro"] },
        { id: "first", lead: "Sector by sector", steps: rows.slice(0, half).map(r => `sector-${r.s}`) },
        { id: "rest", lead: "The other sectors", steps: rows.slice(half).map(r => `sector-${r.s}`) },
        { id: "limits", lead: "What nearest means", steps: ["caveat"] },
      ],
      limits: ["Nearest is a measured distance between colours; it says nothing about influence.", "The museums give a named style on few works, so most groups are a department and a half-century."],
      fallback: common ? `${common[0]} is the nearest museum group for ${common[1]} of ${rows.length} sectors` : m.question });
}
