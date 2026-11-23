// W3c · one colour at a time: a brand's measured accent against the colours the stored museum works hold. Not a palette match (that is
// palette.ts and `comparable()`, kept for the old study): one vivid colour from each brand, and the question is whether any stored work
// holds that colour in real space. The misses are as much the finding as the hits. Pure: no I/O.
//
// Method (five lines):
//   1. A brand's accent is the newest measured accent of its live desktop homepage (the Data view's ACCENT). It counts only when vivid:
//      OKLCH chroma at or above ACCENT_MIN_CHROMA, lightness between ACCENT_MIN_L and ACCENT_MAX_L (not near-black, not near-white).
//   2. A work's colours are its stored palette colours holding WORK_MIN_SHARE of the picture or more. No neutral filter: a brown varnish
//      is far from a vivid accent by distance alone. A removed work holds nothing.
//   3. Distance is plain OKLab distance; a work's distance to an accent is its nearest such colour.
//   4. A work holds the accent when that distance is within HELD_DISTANCE. The nearest work wins; ties go to the larger share.
//   5. The accent's family is its hue as the study strips name it (colour-family.ts), one of the eight HUE_FAMILIES.
import { familyOf } from "../colour-family";
import { chroma, oklab, type Lab, type Swatch } from "./palette";

/** OKLCH chroma from which an accent reads as a vivid hue on screen (a teal button, a bright orange), not a muted or greyed tint. */
export const ACCENT_MIN_CHROMA = 0.1;
/** Under this OKLab lightness an accent reads as near-black (a navy-black, an ink), whatever its tint. */
export const ACCENT_MIN_L = 0.3;
/** Over this OKLab lightness an accent reads as near-white (a pale tint), whatever its hue. */
export const ACCENT_MAX_L = 0.94;
/** A colour holding under 2% of the picture is a detail no reader would call the picture's colour. */
export const WORK_MIN_SHARE = 0.02;
/** Within this OKLab distance two colours read as the same colour side by side at swatch size (0.02 is about the smallest difference most
 *  people see side by side; past about 0.08 two swatches read as two colours: a different shade, or a neighbouring hue). */
export const HELD_DISTANCE = 0.04;
/** A family gets a row in the study only with this many vivid accents (fewer is a brand or two, not a family). */
export const FAMILY_MIN_ACCENTS = 5;
/** At most this many example pairs per family row. */
export const PAIRS_PER_FAMILY = 3;
/** The study exists for readers only with at least this many vivid accents ... */
export const STUDY_MIN_ACCENTS = 150;
/** ... and at least this many stored works. */
export const STUDY_MIN_WORKS = 500;
/** The eight hue families the strips draw, in the strips' hue order. */
export const HUE_FAMILIES = ["red", "orange", "yellow", "green", "teal", "blue", "violet", "pink"] as const;
export type HueFamily = (typeof HUE_FAMILIES)[number];

const HEX = /^#[0-9a-f]{6}$/i;
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
export const labDistance = (x: Lab, y: Lab) => Math.hypot(x.L - y.L, x.a - y.a, x.b - y.b);
/** The hue family as the strips name it (colour-family.ts), or null for a colour the strips call white, grey or black. */
export function hueFamily(hex: string): HueFamily | null {
  if (!HEX.test(hex)) return null;
  const id = familyOf(hex).id;
  return id.startsWith("n-") ? null : (id.split("-")[0] as HueFamily);
}
export const familyLabel = (f: string) => f.charAt(0).toUpperCase() + f.slice(1);

export type Accent = { hex: string; lab: Lab; chroma: number; family: HueFamily };
/** Why an accent is not counted: none measured, not a colour, under the chroma line, near-black or near-white. */
export type NotVivid = "no accent" | "not a colour" | "not vivid" | "near-black" | "near-white";
/** Rule 1 · the accent, when it is vivid; otherwise why not. */
export function vividAccent(hex: string | null | undefined): { ok: true; accent: Accent } | { ok: false; reason: NotVivid } {
  if (hex == null || hex === "") return { ok: false, reason: "no accent" };
  if (!HEX.test(hex)) return { ok: false, reason: "not a colour" };
  const lab = oklab(hex), c = chroma(lab), family = hueFamily(hex);
  if (lab.L < ACCENT_MIN_L) return { ok: false, reason: "near-black" };
  if (lab.L > ACCENT_MAX_L) return { ok: false, reason: "near-white" };
  if (c < ACCENT_MIN_CHROMA - 1e-9 || !family) return { ok: false, reason: "not vivid" };
  return { ok: true, accent: { hex: hex.toUpperCase(), lab, chroma: r4(c), family } };
}

export type WorkIn = { source: string; source_id: string; palette: readonly Swatch[]; removed_at?: string | null };
export type WorkColour = { hex: string; share: number; lab: Lab };
/** Rule 2 · the colours a work holds in real space (share at or over WORK_MIN_SHARE); none for a removed work. */
export function workColours(w: Pick<WorkIn, "palette" | "removed_at">): WorkColour[] {
  if (w.removed_at) return [];
  return w.palette.filter(p => HEX.test(p.hex) && Number.isFinite(p.share) && p.share >= WORK_MIN_SHARE - 1e-9).map(p => ({ hex: p.hex.toUpperCase(), share: p.share, lab: oklab(p.hex) }));
}
export const workKey = (w: Pick<WorkIn, "source" | "source_id">) => `${w.source}:${w.source_id}`;

export type Hold<W extends WorkIn = WorkIn> = { work: W; colour: { hex: string; share: number }; distance: number };
/** Rule 3 · a work's distance to an accent: its nearest held colour (ties to the larger share), or null when it holds no colour. */
export function workDistance<W extends WorkIn>(a: Pick<Accent, "lab">, w: W): Hold<W> | null {
  let best: Hold<W> | null = null;
  for (const c of workColours(w)) {
    const d = r4(labDistance(a.lab, c.lab));
    if (!best || d < best.distance || (d === best.distance && c.share > best.colour.share)) best = { work: w, colour: { hex: c.hex, share: c.share }, distance: d };
  }
  return best;
}
/** Every work ordered nearest first (ties: the larger share, then the work's key), with its nearest colour. */
export function nearestWorks<W extends WorkIn>(a: Pick<Accent, "lab">, works: readonly W[]): Hold<W>[] {
  return works.flatMap(w => { const h = workDistance(a, w); return h ? [h] : []; })
    .sort((x, y) => x.distance - y.distance || y.colour.share - x.colour.share || workKey(x.work).localeCompare(workKey(y.work)));
}
/** Rule 4 · the nearest work and whether it holds the accent (within `limit`). */
export function holdOf<W extends WorkIn>(a: Pick<Accent, "lab">, works: readonly W[], limit = HELD_DISTANCE): { nearest: Hold<W> | null; held: boolean } {
  const nearest = nearestWorks(a, works)[0] ?? null;
  return { nearest, held: !!nearest && nearest.distance <= limit + 1e-9 };
}

export type BrandIn = { domain: string; accent: string | null | undefined };
export type BrandMatch<W extends WorkIn = WorkIn> = { domain: string; accent: Accent; nearest: Hold<W> | null; held: boolean };
/** Every brand with a vivid accent, matched (domain order). */
export function accentMatches<W extends WorkIn>(brands: readonly BrandIn[], works: readonly W[], limit = HELD_DISTANCE): BrandMatch<W>[] {
  const live = works.filter(w => !w.removed_at);
  return [...brands].sort((a, b) => a.domain.localeCompare(b.domain)).flatMap(b => {
    const v = vividAccent(b.accent);
    if (!v.ok) return [];
    const h = holdOf(v.accent, live, limit);
    return [{ domain: b.domain, accent: v.accent, nearest: h.nearest, held: h.held }];
  });
}

export type FamilyRow<W extends WorkIn = WorkIn> = { family: HueFamily; accents: BrandMatch<W>[]; held: number; total: number; pairs: BrandMatch<W>[]; closest: BrandMatch<W> | null };
/** Rule 5 · one row per family with FAMILY_MIN_ACCENTS vivid accents or more (`all` keeps the smaller ones, for the counts), ordered from
 *  most held to least held (share held, then count held, then the strips' hue order), so the empty families sit together at the bottom.
 *  `pairs`: up to PAIRS_PER_FAMILY held accents, nearest first, one per work where the family allows. `closest`: the nearest pair, held or not. */
export function familyRows<W extends WorkIn>(matches: readonly BrandMatch<W>[], o: { all?: boolean } = {}): FamilyRow<W>[] {
  const near = (x: BrandMatch<W>, y: BrandMatch<W>) => (x.nearest?.distance ?? Infinity) - (y.nearest?.distance ?? Infinity) || (y.nearest?.colour.share ?? 0) - (x.nearest?.colour.share ?? 0) || x.domain.localeCompare(y.domain);
  return HUE_FAMILIES.map(family => {
    const accents = matches.filter(m => m.accent.family === family).sort((a, b) => a.accent.lab.L - b.accent.lab.L || a.domain.localeCompare(b.domain));
    const held = accents.filter(m => m.held).sort(near), used = new Set<string>(), pairs: BrandMatch<W>[] = [];
    for (const m of held) if (pairs.length < PAIRS_PER_FAMILY && !used.has(workKey(m.nearest!.work))) { pairs.push(m); used.add(workKey(m.nearest!.work)); }
    for (const m of held) if (pairs.length < PAIRS_PER_FAMILY && !pairs.includes(m)) pairs.push(m);
    pairs.sort(near);
    return { family, accents, held: held.length, total: accents.length, pairs, closest: [...accents].sort(near)[0] ?? null };
  }).filter(r => r.total > 0 && (o.all || r.total >= FAMILY_MIN_ACCENTS))
    .sort((a, b) => b.held / b.total - a.held / a.total || b.held - a.held || HUE_FAMILIES.indexOf(a.family) - HUE_FAMILIES.indexOf(b.family));
}

/** Rule-written headline: it claims only what the stored numbers show (never anything about painting in general). */
export function accentHeadline(rows: readonly Pick<FamilyRow, "family" | "held" | "total">[], works: number): string {
  const none = rows.filter(r => r.total >= FAMILY_MIN_ACCENTS && r.held === 0).map(r => r.family);
  if (none.length >= 2) return `None of ${works} museum works holds brand ${none.length === 2 ? `${none[0]} or ${none[1]}` : `${none.slice(0, -1).join(", ")} or ${none.at(-1)}`}`;
  const top = rows.find(r => r.total >= FAMILY_MIN_ACCENTS);
  return top ? `${familyLabel(top.family)} is the brand colour museum works hold most: ${top.held} of ${top.total}` : "Brand accents against museum works";
}
/** The figures the study and its check read. */
export type AccentFigures = { works: number; paintings: number; prints: number; brands: number; vivid: number; held: number; families: { family: HueFamily; held: number; total: number }[] };
export function accentFigures(brands: readonly BrandIn[], works: readonly (WorkIn & { kind?: string })[], limit = HELD_DISTANCE): AccentFigures {
  const live = works.filter(w => !w.removed_at), m = accentMatches(brands, live, limit);
  return { works: live.length, paintings: live.filter(w => w.kind === "painting").length, prints: live.filter(w => w.kind === "print").length, brands: brands.length,
    vivid: m.length, held: m.filter(x => x.held).length, families: familyRows(m, { all: true }).map(r => ({ family: r.family, held: r.held, total: r.total })) };
}
/** The study's check: the headline's numbers and named families are exactly the stored ones (recomputed, never trusted). */
export function headlineHolds(headline: string, f: Pick<AccentFigures, "works" | "families">): boolean {
  return headline === accentHeadline(f.families, f.works);
}
