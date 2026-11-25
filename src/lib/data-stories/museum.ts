// W3a · Study: which museum group each sector's homepages are nearest to, by palette. Pure over DataInput.art (the stored, not removed,
// public-domain works and every active brand's newest measured palette). Existing chart form only (swatch strips). Hidden from readers
// until the works clear readyToShow (200 works, 8 groups of 15): the registry marks it `hidden` and the check is `museum`.
// W3b · and built only when at least STUDY_MIN_SECTORS sectors name a group under the comparable-palette rules (art/palette.ts);
// otherwise it is "not enough for a finding" on the In the works list, with its counts. Readers see none of it while MUSEUM_SHOWN is false.
import type { Figure, Step, StoryModel, Swatch as FigSwatch } from "./types";
import { cap, list, num, ref, sectorHref, dayText } from "./text";
import { model, type Captures, type Meta } from "./stories";
import type { DataInput } from "./series";
import { familyOf } from "./templates/drift";
import { comparable, distance, groupOf, groups, nearestForSector, readyToShow, GROUP_MIN_WORKS, SECTOR_MIN_HOMEPAGES, SHOW_MIN_GROUPS, SHOW_MIN_WORKS, STUDY_MIN_SECTORS, VARIED_COLOUR_SHARE, VARIED_MAX_SHARE, VARIED_MIN_COLOURS, MEDIA_COVERAGE, type Colour, type Group, type Hero, type SectorMatch, type Swatch, type Work } from "../art/palette";
import { MUSEUM_NAME, type ArtSource } from "../art/contract";
import { storySectorName as sectorName } from "../labels";
import { SECTORS } from "../library";

/** What the museum study reads, loaded beside the other study inputs (absent or empty: the study does not exist for readers). */
export type ArtWorkIn = Work & { link: string; read_at?: string | null; /** W3c · what the one-colour study reads beside the palette. */ kind?: string; thumb?: string | null; width?: number; height?: number; removed_at?: string | null };
export type ArtInput = { works: ArtWorkIn[]; brands: { domain: string; sector: string; palette: Swatch[]; hero?: Hero | null; /** W3c · the newest measured accent. */ accent?: string | null }[]; through: string | null };
/** At most this many example works per sector row, each credited and linked. */
export const EXAMPLES_PER_SECTOR = 3;
export const MUSEUM_SLUG = "nearest-in-the-museum";

/** W3b · every sector with tracked homepages, matched under the comparable-palette rules (no group named below SECTOR_MIN_*). */
export function museumRows(i: Pick<DataInput, "art" | "sites">): { s: string; bs: ArtInput["brands"]; m: SectorMatch }[] {
  const art = i.art ?? { works: [], brands: [], through: null }, gs = groups(art.works);
  const active = new Set(i.sites.filter(s => s.active).map(s => s.domain)), brands = art.brands.filter(b => active.has(b.domain));
  return SECTORS.map(s => ({ s: s as string, bs: brands.filter(b => b.sector === s) })).filter(r => r.bs.length).map(r => ({ ...r, m: nearestForSector(r.s, r.bs, gs) }));
}
/** `ready`: the stored works clear the intake line; `sectors` of `sectorRows` name a group (the study needs STUDY_MIN_SECTORS). */
export type MuseumFigures = { works: number; groups: number; ready: boolean; sectors: number; sectorRows: number; compared: number; homepages: number; comparableWorks: number; comparableGroups: number };
export const museumFigures = (i: Pick<DataInput, "art" | "sites">): MuseumFigures => {
  const r = readyToShow(i.art?.works ?? []), rows = r.ready ? museumRows(i) : [];
  return { works: r.works, groups: r.groups, ready: r.ready, sectors: rows.filter(x => x.m.group).length, sectorRows: rows.length,
    compared: rows.reduce((a, x) => a + x.m.compared, 0), homepages: rows.reduce((a, x) => a + x.m.base, 0),
    comparableWorks: (i.art?.works ?? []).filter(w => comparable(w.palette).ok).length, comparableGroups: r.ready ? groups(i.art?.works ?? []).length : 0 };
};
export const museumVerdictText = (f: MuseumFigures) => !f.ready
  ? `Has ${f.works} public-domain works in ${f.groups} groups of ${GROUP_MIN_WORKS}; needs ${SHOW_MIN_WORKS} works and ${SHOW_MIN_GROUPS} groups.`
  : `Not enough for a finding: ${f.sectors} of ${f.sectorRows} sectors name a museum group (needs ${STUDY_MIN_SECTORS}). ${f.comparableWorks} of ${f.works} works, ${f.comparableGroups} groups and ${f.compared} of ${f.homepages} homepages have a varied enough palette to compare.`;

const pooled = (palettes: readonly { palette: Swatch[]; hero?: Hero | null }[]): FigSwatch[] => {
  const by = new Map<string, FigSwatch>();
  const live = palettes.flatMap(p => { const c = comparable(p.palette, p.hero); return c.ok ? [c.colours] : []; });
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
  return works.filter(w => groupOf(w).key === g.key).flatMap(w => { const c = comparable(w.palette); return c.ok ? [{ w, d: distance(sectorColours, c.colours) }] : []; })
    .sort((a, b) => a.d - b.d || `${a.w.source}:${a.w.source_id}`.localeCompare(`${b.w.source}:${b.w.source_id}`)).slice(0, EXAMPLES_PER_SECTOR).map(x => x.w);
}

export function museumStory(i: DataInput, _caps: Captures, m: Meta): StoryModel {
  const art = i.art ?? { works: [], brands: [], through: null }, gs = groups(art.works), href = `/data/${MUSEUM_SLUG}`;
  const rows = museumRows(i), named = rows.filter(r => r.m.group), brands = rows.flatMap(r => r.bs);
  const bands = named.flatMap(r => [
    { q: `${sectorName(r.s)} homepages`, brands: r.m.compared, swatches: pooled(r.bs) },
    { q: `${sectorName(r.s)}: nearest, ${r.m.group!.name}`, brands: r.m.group!.works, swatches: groupSwatches(r.m.group!) },
  ]);
  const fig: Figure = { kind: "drift", title: "Each sector's homepage colours beside its nearest museum group", rowHead: "Row",
    note: "Upper strip: the sector's comparable homepage colours pooled, neutrals set aside. Lower strip: the group of public-domain works most of them are nearest to. Width is share. Sectors where no group stands out have no strips.", scope: "All sectors", bands };
  const cnt = (v: number, h: string) => num(String(v), v, h);
  const steps: Step[] = [];
  const sources = [...new Set(art.works.map(w => w.source))].length, comparableWorks = art.works.filter(w => comparable(w.palette).ok).length;
  const compared = rows.reduce((a, r) => a + r.m.compared, 0);
  steps.push({ id: "intro", caption: cap`${cnt(art.works.length, href)} public-domain works from ${cnt(sources, href)} museums; ${cnt(comparableWorks, href)} have a varied palette, in ${cnt(gs.length, href)} groups, against ${cnt(compared, "/brands")} of ${cnt(brands.length, "/brands")} tracked homepages whose measured palette is varied too.`, view: { figure: "drift", highlight: [] } });
  for (const r of rows) {
    const out = r.m.base - r.m.compared, sh = sectorHref(r.s);
    if (!r.m.group) {
      steps.push({ id: `sector-${r.s}`, caption: cap`${ref(sectorName(r.s), sh)}: no group stands out. ${cnt(r.m.count, sh)} of ${cnt(r.m.compared, sh)} comparable homepages are nearest to the commonest group (a group needs a third of them, and ${cnt(SECTOR_MIN_HOMEPAGES, sh)} at least); ${cnt(out, sh)} of ${cnt(r.m.base, sh)} have no comparable palette.`, view: { figure: "drift", highlight: [] } });
      continue;
    }
    const g = r.m.group, live = r.bs.flatMap(b => { const c = comparable(b.palette, b.hero); return c.ok ? [c.colours] : []; });
    const sc: Colour[] = live.flatMap(cs => cs.map(c => ({ ...c, w: c.w / live.length })));
    const ex = sc.length ? examples(g, art.works, sc) : [];
    const exSegs = ex.map(w => ref(credit(w), w.link));
    steps.push({ id: `sector-${r.s}`, caption: [
      ...cap`${cnt(r.m.count, sh)} of ${cnt(r.m.compared, sh)} comparable ${ref(sectorName(r.s), sh)} homepages are nearest to ${ref(g.name, href)}; ${cnt(out, sh)} of ${cnt(r.m.base, sh)} have no comparable palette.`,
      ...(exSegs.length ? [" Examples: ", ...list(exSegs), "."] : []),
    ], view: { figure: "drift", highlight: [], focus: `${sectorName(r.s)}: nearest, ${g.name}` } });
  }
  steps.push({ id: "caveat", caption: ["Nearest is a measured distance between colours. It says nothing about influence. Works and homepages that are mostly one colour (aged paper, dark varnish, a single brand colour), mostly neutral, or a first screen that is mostly a video or a photograph are left out rather than matched."], view: { figure: "drift", highlight: [] } });
  const lead = [...named].sort((a, b) => b.m.count / Math.max(1, b.m.compared) - a.m.count / Math.max(1, a.m.compared) || a.s.localeCompare(b.s))[0];
  const common = (() => { const c = new Map<string, number>(); for (const r of named) c.set(r.m.group!.name, (c.get(r.m.group!.name) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]; })();
  const half = Math.ceil(rows.length / 2);
  const date = art.through ? dayText(art.through) : "—";
  return model(m, i, { drift: fig }, steps,
    { brands: compared, captures: compared, period: date,
      rule: `A palette is up to eight colours a homepage's first screen (or a museum's picture) is made of, each with its share. Near-neutrals (white, grey, black) are set aside on both sides. A palette is compared only when no one colour family holds more than ${Math.round(VARIED_MAX_SHARE * 100)}% of what is left and at least ${VARIED_MIN_COLOURS} hold ${Math.round(VARIED_COLOUR_SHARE * 100)}% or more; a homepage whose first screen is more than ${Math.round(MEDIA_COVERAGE * 100)}% video or photograph is not compared. Nearest is the smallest measured distance in a perceptual colour space, weighted by share; it says nothing about influence.`,
      lines: [`${art.works.length} public-domain works (CC0) from The Metropolitan Museum of Art and The Art Institute of Chicago, as stored on ${date}; ${comparableWorks} have a varied palette.`, `A group is a movement as the museum labels it, or its department and half-century, read only with ${GROUP_MIN_WORKS} comparable works or more.`, `A sector names a group only when at least a third of its comparable homepages, and ${SECTOR_MIN_HOMEPAGES} at least, are nearest to it; the study is written only when ${STUDY_MIN_SECTORS} sectors do.`] },
    lead ? { n: `${lead.m.count} of ${lead.m.compared}`, label: `comparable ${sectorName(lead.s)} homepages nearest to ${lead.m.group!.name}` } : { n: "—", label: "homepages nearest to a museum group" },
    { scenes: [
        { id: "intro", lead: "Two museums, every homepage", steps: ["intro"] },
        { id: "first", lead: "Sector by sector", steps: rows.slice(0, half).map(r => `sector-${r.s}`) },
        { id: "rest", lead: "The other sectors", steps: rows.slice(half).map(r => `sector-${r.s}`) },
        { id: "limits", lead: "What nearest means", steps: ["caveat"] },
      ],
      limits: ["Nearest is a measured distance between colours; it says nothing about influence.", "Palettes that are mostly one colour, mostly neutral, or a video or photograph are left out, so most homepages and works are not compared.", "The museums give a named style on few works, so most groups are a department and a half-century."],
      fallback: common ? `${common[0]} is the nearest museum group for ${common[1]} of ${rows.length} sectors` : m.question });
}
