// W3a · nearest palette: a brand homepage's measured palette against public-domain works' palettes, both read with the crawler's
// same method (paletteFromScreenshot), so the comparison is like with like. A match is a measured distance between colours; it says
// nothing about influence. Pure: no I/O.
//
// Method (five lines):
//   1. Every colour goes to OKLab (a perceptual space: equal steps look equally different).
//   2. Specks under MIN_SHARE and near-neutrals (low chroma, or near-black) are set aside on both sides: a white page is not a white wall.
//   3. What is left is re-weighted to sum to 1; fewer than MIN_COLOURS colours, or under MIN_COLOUR_SHARE of colour in all, is "mostly neutral".
//   4. Distance is the cost of moving one weighted palette onto the other (greedy transport, nearest pairs first; symmetric, 0 = identical).
//   5. A group's palette pools its works (each work weighs the same) and merges the nearest colours down to GROUP_COLOURS.
// W3b · a match has to mean something:
//   6. A work, a group or a brand is comparable only when its colours are varied (VARIED_*): paper and varnish are not a palette.
//      "One colour" is a colour family as the study strips draw it (colour-family.ts), so a beige split into three shades is one beige.
//   7. A brand whose first screen is mostly a video or a photograph (MEDIA_*) gets no match: those are the picture's colours, not the
//      brand's, and the stored fallback (accent and page background, no button colour) is at most two colours, which rule 6 refuses.
//   8. A group pools only its comparable works and needs GROUP_MIN_WORKS of them; a sector names a group only past SECTOR_MIN_*.

/** Specks under 1% of the picture are edge and anti-aliasing noise, not a colour anyone sees. */
export const MIN_SHARE = 0.01;
/** OKLab chroma under 0.035 reads as white, grey, black or a faint tint (a white page, a white wall, dark varnish), never as a hue. */
export const NEUTRAL_CHROMA = 0.035;
/** Under this lightness a colour reads as near-black (dark varnish, a dark page) unless its chroma reaches DARK_CHROMA. */
export const DARK_L = 0.25;
/** A near-black still counts as a colour from this chroma up (a deep navy or oxblood, not a tinted black). */
export const DARK_CHROMA = 0.08;
/** With fewer than two colours left there is one hue and nothing to compare as a palette. */
export const MIN_COLOURS = 2;
/** Under 3% of colour in all, a page or picture is neutral with a few specks; matching the specks would be noise. */
export const MIN_COLOUR_SHARE = 0.03;
/** A work is "near" only under this distance (OKLab units; 0.02 is about the smallest difference most people see side by side). */
export const NEAR_DISTANCE = 0.07;
/** A group (a movement, or a tradition and half-century) is read only with at least this many works. */
export const GROUP_MIN_WORKS = 15;
/** A group's palette keeps at most this many colours after merging. */
export const GROUP_COLOURS = 8;
/** Readers see nothing of this until at least this many works are stored ... */
export const SHOW_MIN_WORKS = 200;
/** ... in at least this many groups that hold GROUP_MIN_WORKS works each. */
export const SHOW_MIN_GROUPS = 8;
/** If more than this share of matched brands land on one work, the method is clumping, not matching. */
export const CLUMP_SHARE = 0.2;

import { familyOf } from "../colour-family";

/** W3b · a palette is varied only when, neutrals set aside, no one colour family holds more than this share ... */
export const VARIED_MAX_SHARE = 0.6;
/** ... and at least this many colour families hold VARIED_COLOUR_SHARE or more each. */
export const VARIED_MIN_COLOURS = 3;
export const VARIED_COLOUR_SHARE = 0.05;
/** W3b · a hero measured as one of these that covers more than MEDIA_COVERAGE of the first screen is a picture's colours, not the brand's. */
export const MEDIA_HEROES: readonly string[] = ["video", "image"];
export const MEDIA_COVERAGE = 0.5;
/** W3b · a sector names its nearest group only when at least this share of its compared homepages are nearest to it ... */
export const SECTOR_MIN_SHARE = 1 / 3;
/** ... and they are at least this many homepages. */
export const SECTOR_MIN_HOMEPAGES = 8;
/** W3b · the study makes a claim about sectors only when at least this many sectors name a group; otherwise it is not built. */
export const STUDY_MIN_SECTORS = 5;

export type Swatch = { hex: string; share: number };
export type Lab = { L: number; a: number; b: number };
export type Colour = Lab & { w: number; hex: string };
export type Chromatic = { ok: true; colours: Colour[]; colourShare: number } | { ok: false; reason: "mostly neutral"; colourShare: number };

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** sRGB hex → OKLab (Björn Ottosson's matrices). */
export function oklab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16), r = lin(((n >> 16) & 255) / 255), g = lin(((n >> 8) & 255) / 255), b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return { L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s };
}
export const chroma = (c: Lab) => Math.hypot(c.a, c.b);
/** Near-neutral: low chroma at any lightness, or a dark colour whose tint is too faint to read as a hue. */
export const neutralLab = (c: Lab) => chroma(c) < NEUTRAL_CHROMA || (c.L < DARK_L && chroma(c) < DARK_CHROMA);
export const isNeutral = (hex: string) => neutralLab(oklab(hex));
const dist = (x: Lab, y: Lab) => Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
const HEX = /^#[0-9a-f]{6}$/i;

/** The colours left once specks and near-neutrals are set aside, re-weighted to 1 (or "mostly neutral"). `keepNeutrals` is for the proof only. */
export function chromatic(palette: readonly Swatch[], o: { keepNeutrals?: boolean } = {}): Chromatic {
  const kept = palette.filter(p => HEX.test(p.hex) && Number.isFinite(p.share) && p.share >= MIN_SHARE).map(p => ({ ...oklab(p.hex), w: p.share, hex: p.hex.toUpperCase() }))
    .filter(c => o.keepNeutrals || !neutralLab(c));
  const total = kept.reduce((a, c) => a + c.w, 0);
  if (kept.length < MIN_COLOURS || total < MIN_COLOUR_SHARE) return { ok: false, reason: "mostly neutral", colourShare: total };
  return { ok: true, colours: kept.map(c => ({ ...c, w: c.w / total })).sort((a, b) => b.w - a.w), colourShare: total };
}

/** The cost of moving one weighted palette onto the other, nearest pairs first. Symmetric; 0 when the palettes are the same. */
export function distance(p: readonly Colour[], q: readonly Colour[]): number {
  const pairs: { i: number; j: number; d: number }[] = [];
  p.forEach((x, i) => q.forEach((y, j) => pairs.push({ i, j, d: dist(x, y) })));
  // Ties break on the colours themselves, never on which side is which, so d(p, q) = d(q, p).
  pairs.sort((a, b) => a.d - b.d || (p[a.i]!.hex + q[a.j]!.hex < p[b.i]!.hex + q[b.j]!.hex ? -1 : 1));
  const left = p.map(c => c.w), right = q.map(c => c.w);
  let cost = 0, moved = 0;
  for (const { i, j, d } of pairs) {
    const m = Math.min(left[i]!, right[j]!);
    if (m <= 0) continue;
    cost += m * d; moved += m; left[i]! -= m; right[j]! -= m;
    if (moved >= 1 - 1e-9) break;
  }
  return Math.round(cost * 1e6) / 1e6;
}

/** W3b · a palette's colour families (as the strips draw them) with their shares, largest first. */
export function familyShares(cs: readonly Pick<Colour, "hex" | "w">[]): { id: string; w: number }[] {
  const by = new Map<string, number>();
  for (const c of cs) { const id = familyOf(c.hex).id; by.set(id, (by.get(id) ?? 0) + c.w); }
  return [...by].map(([id, w]) => ({ id, w })).sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));
}
/** W3b · varied: no family over VARIED_MAX_SHARE and at least VARIED_MIN_COLOURS families of VARIED_COLOUR_SHARE or more. */
export function varied(cs: readonly Pick<Colour, "hex" | "w">[]): boolean {
  const f = familyShares(cs);
  return f.length > 0 && f[0]!.w <= VARIED_MAX_SHARE + 1e-9 && f.filter(x => x.w >= VARIED_COLOUR_SHARE - 1e-9).length >= VARIED_MIN_COLOURS;
}
/** What the first screen's hero was measured as, and how much of the first screen media covers (stored with each capture). */
export type Hero = { media: string | null; coverage: number | null };
export const mediaLed = (h: Hero | null | undefined) => !!h && !!h.media && MEDIA_HEROES.includes(h.media) && (h.coverage ?? 0) > MEDIA_COVERAGE;
export type NoMatch = "mostly neutral" | "not varied" | "photo or video";
export type Comparable = { ok: true; colours: Colour[]; colourShare: number } | { ok: false; reason: NoMatch; colourShare: number };
/** W3b · the colours a palette is compared on, or why it is not compared (a hero that is mostly video or a photograph, mostly neutral, not varied). */
export function comparable(palette: readonly Swatch[], hero?: Hero | null, o: { keepNeutrals?: boolean } = {}): Comparable {
  const c = chromatic(palette, o);
  if (mediaLed(hero)) return { ok: false, reason: "photo or video", colourShare: c.colourShare };
  if (!c.ok) return { ok: false, reason: "mostly neutral", colourShare: c.colourShare };
  if (!varied(c.colours)) return { ok: false, reason: "not varied", colourShare: c.colourShare };
  return c;
}

export type Work = { source: string; source_id: string; title: string; artist: string | null; date_display: string; year_start: number; tradition: string; movement: string | null; palette: readonly Swatch[] };
/** W3b · the museum that gave a movement label, as a group name says it. */
const LABELLER: Record<string, string> = { met: "the Met", aic: "the Art Institute of Chicago" };
/** A movement where the museum gives one; otherwise the tradition and half-century ("European paintings, 1850 to 1899"). W3b · a
 *  movement group is named with the museum's label in full and whose label it is ("Chinese (culture or style), as the Art Institute of
 *  Chicago labels it"), never an adjective alone; the key still joins "Chinese" and "Chinese (culture or style)". */
export function groupOf(w: Pick<Work, "movement" | "tradition" | "year_start"> & { source?: string }): { key: string; name: string } {
  if (w.movement) { const label = w.movement.trim(), short = label.replace(/\s*\(culture or style\)\s*$/i, "").trim();
    return { key: `movement:${short.toLowerCase()}`, name: `${label}, as ${(w.source && LABELLER[w.source]) || "the museum"} labels it` }; }
  const h = Math.floor(w.year_start / 50) * 50;
  return { key: `tradition:${w.tradition.toLowerCase()}:${h}`, name: `${w.tradition}, ${h} to ${h + 49}` };
}

/** Merge a pooled list of colours to at most `k`, joining the nearest pair (weighted mean in OKLab) each time. */
function merge(cs: Colour[], k: number): Colour[] {
  const out = cs.map(c => ({ ...c }));
  while (out.length > k) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const d = dist(out[i]!, out[j]!); if (d < bd) { bd = d; bi = i; bj = j; } }
    const x = out[bi]!, y = out[bj]!, w = x.w + y.w;
    out[bi] = { L: (x.L * x.w + y.L * y.w) / w, a: (x.a * x.w + y.a * y.w) / w, b: (x.b * x.w + y.b * y.w) / w, w, hex: x.w >= y.w ? x.hex : y.hex };
    out.splice(bj, 1);
  }
  return out.sort((a, b) => b.w - a.w);
}
/** `works` is the group's comparable works (its palette's base); `stored` is every stored work in it. */
export type Group = { key: string; name: string; works: number; stored: number; colours: Colour[] };
/** W3b · groups with at least GROUP_MIN_WORKS comparable works, each palette pooled from those works only (every work weighing the same),
 *  kept only when the pooled palette is itself varied. */
export function groups(works: readonly Work[]): Group[] {
  const by = new Map<string, { names: Set<string>; works: Work[] }>();
  for (const w of works) { const g = groupOf(w); const e = by.get(g.key) ?? { names: new Set<string>(), works: [] }; e.names.add(g.name); e.works.push(w); by.set(g.key, e); }
  const out: Group[] = [];
  for (const [key, e] of by) {
    const cw = e.works.flatMap(w => { const c = comparable(w.palette); return c.ok ? [c.colours] : []; });
    if (cw.length < GROUP_MIN_WORKS) continue;
    const pooled = cw.flatMap(cs => cs.map(x => ({ ...x, w: x.w / cw.length })));
    const total = pooled.reduce((a, c) => a + c.w, 0), colours = merge(pooled, GROUP_COLOURS).map(c => ({ ...c, w: c.w / total }));
    if (!varied(colours)) continue;
    // One label from two museums reads as the museums' label; one museum's stays its own.
    const name = e.names.size === 1 ? [...e.names][0]! : [...e.names][0]!.replace(/, as .+ labels it$/, ", as the museums label it");
    out.push({ key, name, works: cw.length, stored: e.works.length, colours });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}
/** Readers see Parts B and C only once enough is stored. */
export function readyToShow(works: readonly Pick<Work, "movement" | "tradition" | "year_start">[]): { ready: boolean; works: number; groups: number } {
  const counts = new Map<string, number>();
  for (const w of works) { const k = groupOf(w).key; counts.set(k, (counts.get(k) ?? 0) + 1); }
  const g = [...counts.values()].filter(n => n >= GROUP_MIN_WORKS).length;
  return { ready: works.length >= SHOW_MIN_WORKS && g >= SHOW_MIN_GROUPS, works: works.length, groups: g };
}

export type BrandMatch =
  | { domain: string; neutral: true; reason: NoMatch; colourShare: number }
  | { domain: string; neutral: false; work: { w: Work; distance: number; near: boolean } | null; group: { g: Group; distance: number } | null };
/** For one brand: the nearest comparable work (kept only when near) and the nearest group. Ties go to the lower key, so the answer is
 *  stable. W3b · a brand that is not comparable (see `comparable`) gets no match and says why. */
export function nearestFor(domain: string, palette: readonly Swatch[], works: readonly Work[], gs: readonly Group[], o: { keepNeutrals?: boolean; hero?: Hero | null } = {}): BrandMatch {
  const b = comparable(palette, o.hero, o);
  if (!b.ok) return { domain, neutral: true, reason: b.reason, colourShare: b.colourShare };
  let work: { w: Work; distance: number } | null = null;
  for (const w of works) {
    const c = comparable(w.palette, null, o); if (!c.ok) continue;
    const d = distance(b.colours, c.colours);
    if (!work || d < work.distance || (d === work.distance && `${w.source}:${w.source_id}` < `${work.w.source}:${work.w.source_id}`)) work = { w, distance: d };
  }
  let group: { g: Group; distance: number } | null = null;
  for (const g of gs) { const d = distance(b.colours, g.colours); if (!group || d < group.distance) group = { g, distance: d }; }
  return { domain, neutral: false, work: work ? { ...work, near: work.distance < NEAR_DISTANCE } : null, group };
}
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
export type SectorMatch = {
  sector: string; base: number;
  /** Homepages with a comparable palette (each has a nearest group when any group exists). */
  compared: number;
  /** Homepages left out, by reason. */
  excluded: Record<NoMatch, number>;
  /** The group most compared homepages are nearest to (ties: lower middle distance, then lower key), with that count, whether or not it stands out. */
  top: Group | null; count: number; median: number | null;
  /** W3b · named only when `count` is at least SECTOR_MIN_SHARE of `compared` and at least SECTOR_MIN_HOMEPAGES; otherwise no group stands out. */
  group: Group | null;
};
/** For a sector: which group its comparable homepages are each nearest to. The commonest leads (count first; the middle distance only
 *  breaks ties, because choosing by middle distance alone picked a compromise group no brand was nearest to). W3b · the sector names it
 *  only past SECTOR_MIN_SHARE and SECTOR_MIN_HOMEPAGES, so a sector row never rests on two to five homepages. */
export function nearestForSector(sector: string, brands: readonly { domain: string; palette: readonly Swatch[]; hero?: Hero | null }[], gs: readonly Group[]): SectorMatch {
  const reads = brands.map(b => comparable(b.palette, b.hero)), live = reads.filter((c): c is Extract<Comparable, { ok: true }> => c.ok);
  const excluded: Record<NoMatch, number> = { "mostly neutral": 0, "not varied": 0, "photo or video": 0 };
  for (const c of reads) if (!c.ok) excluded[c.reason] += 1;
  const none = { sector, base: brands.length, compared: live.length, excluded, top: null, count: 0, median: null, group: null };
  if (!live.length || !gs.length) return none;
  const counts = new Map<string, number>();
  for (const c of live) { let n: Group | null = null, nd = Infinity; for (const g of gs) { const d = distance(c.colours, g.colours); if (d < nd || (d === nd && n && g.key < n.key)) { nd = d; n = g; } } if (n) counts.set(n.key, (counts.get(n.key) ?? 0) + 1); }
  const med = new Map(gs.map(g => [g.key, median(live.map(c => distance(c.colours, g.colours)))]));
  const top = [...gs].sort((x, y) => (counts.get(y.key) ?? 0) - (counts.get(x.key) ?? 0) || med.get(x.key)! - med.get(y.key)! || x.key.localeCompare(y.key))[0]!;
  const count = counts.get(top.key) ?? 0, stands = count >= SECTOR_MIN_HOMEPAGES && count >= live.length * SECTOR_MIN_SHARE - 1e-9;
  return { ...none, top, count, median: Math.round(med.get(top.key)! * 1e4) / 1e4, group: stands ? top : null };
}
/** Spread: matched brands, distinct works, and whether one work takes more than CLUMP_SHARE of them (the method would be wrong). */
export function spread(matches: readonly BrandMatch[]): { matched: number; distinct: number; top: { key: string; n: number } | null; clumps: boolean } {
  const near = matches.flatMap(m => (!m.neutral && m.work?.near ? [`${m.work.w.source}:${m.work.w.source_id}`] : []));
  const counts = new Map<string, number>(); for (const k of near) counts.set(k, (counts.get(k) ?? 0) + 1);
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { matched: near.length, distinct: counts.size, top: top ? { key: top[0], n: top[1] } : null, clumps: !!top && near.length > 0 && top[1] / near.length > CLUMP_SHARE };
}
