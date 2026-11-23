// W3c · Study: which brand colours the stored museum works hold, and which they do not. One colour at a time (art/accent.ts): each
// tracked brand's vivid accent against every colour a stored work holds over 2% of the picture. Pure over DataInput.art. Existing chart
// form only (the swatch strips), one row per colour family, most held first, so the families no work holds sit together at the bottom.
// Hidden from readers until STUDY_MIN_ACCENTS vivid accents and STUDY_MIN_WORKS works, and withheld while MUSEUM_SHOWN is false.
import type { DriftBand, DriftFig, DriftPair, Seg, Step, StoryModel } from "./types";
import { cap, num, ref, dayText, brandHref } from "./text";
import { model, type Captures, type Meta } from "./stories";
import type { DataInput } from "./series";
import type { ArtWorkIn } from "./museum";
import { MUSEUM_ACCENT_SLUG } from "./registry";
import { ACCENT_MIN_CHROMA, ACCENT_MAX_L, ACCENT_MIN_L, FAMILY_MIN_ACCENTS, HELD_DISTANCE, STUDY_MIN_ACCENTS, STUDY_MIN_WORKS, WORK_MIN_SHARE, accentFigures, accentHeadline, accentMatches, familyLabel, familyRows, headlineHolds, type AccentFigures, type BrandIn, type BrandMatch, type FamilyRow } from "../art/accent";
import { MUSEUM_NAME, workCredit, type ArtSource } from "../art/contract";

/** The thumbnail is drawn inside this square at most (as the brand line's). */
export const PAIR_THUMB = 64;
type W = ArtWorkIn;
/** Every active tracked brand with its newest measured accent (a brand with none is passed on and not counted). */
export const accentBrands = (i: Pick<DataInput, "art" | "sites">): BrandIn[] => {
  const active = new Set(i.sites.filter(s => s.active).map(s => s.domain));
  return (i.art?.brands ?? []).filter(b => active.has(b.domain)).map(b => ({ domain: b.domain, accent: b.accent ?? null }));
};
const storedWorks = (i: Pick<DataInput, "art">): W[] => (i.art?.works ?? []).filter(w => !w.removed_at);
export type AccentStudyFigures = AccentFigures & { ready: boolean; title: string; /** 1 when the rule's headline matches the stored counts recomputed. */ headline: number };
/** The check's figures, recomputed from stored data every time. */
export function accentStudyFigures(i: Pick<DataInput, "art" | "sites">): AccentStudyFigures {
  const f = accentFigures(accentBrands(i), storedWorks(i)), title = accentHeadline(f.families, f.works);
  return { ...f, ready: f.vivid >= STUDY_MIN_ACCENTS && f.works >= STUDY_MIN_WORKS, title, headline: headlineHolds(title, f) ? 1 : 0 };
}

const museumOf = (w: W) => MUSEUM_NAME[w.source as ArtSource] ?? w.source;
export function pairOf(m: BrandMatch<W>): DriftPair {
  const h = m.nearest!, w = h.work, ww = w.width ?? PAIR_THUMB, wh = w.height ?? PAIR_THUMB, k = Math.min(1, PAIR_THUMB / ww, PAIR_THUMB / wh);
  return { domain: m.domain, brandHex: m.accent.hex, brandHref: brandHref(m.domain), workHex: h.colour.hex, share: h.colour.share, distance: h.distance,
    artist: w.artist, title: w.title, date: w.date_display, museum: museumOf(w), credit: workCredit({ artist: w.artist, title: w.title, date_display: w.date_display, source: w.source as ArtSource }),
    href: w.link, thumb: w.thumb ? `/crops/${w.thumb}` : null, width: Math.max(1, Math.round(ww * k)), height: Math.max(1, Math.round(wh * k)) };
}
const heldLine = (r: Pick<FamilyRow, "held" | "total">) => `${r.held} of ${r.total} brand accents have a near work.`;
export const NONE_HELD = "No stored work holds a colour near these.";
function band(r: FamilyRow<W>, pairs: boolean): DriftBand {
  return { q: familyLabel(r.family), brands: r.total, swatches: r.accents.map(a => ({ id: a.domain, hex: a.accent.hex, w: 1, label: `${a.domain} ${a.accent.hex}` })),
    note: r.held ? heldLine(r) : `${heldLine(r)} ${NONE_HELD}`, ...(pairs && r.pairs.length ? { pairs: r.pairs.map(pairOf) } : {}) };
}
const joinWith = (w: string) => (xs: readonly string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} ${w} ${xs.at(-1)}`);
const joinOr = joinWith("or"), joinAnd = joinWith("and");

export function accentStory(i: DataInput, _caps: Captures, m: Meta): StoryModel {
  const art = i.art ?? { works: [], brands: [], through: null }, href = `/data/${MUSEUM_ACCENT_SLUG}`;
  const works = storedWorks(i), brands = accentBrands(i), f = accentStudyFigures(i);
  const all = familyRows(accentMatches(brands, works)  , { all: true }), rows = all.filter(r => r.total >= FAMILY_MIN_ACCENTS), small = all.filter(r => r.total < FAMILY_MIN_ACCENTS);
  const held = rows.filter(r => r.held > 0), none = rows.filter(r => r.held === 0), half = Math.ceil(held.length / 2);
  const heldA = held.length > 2 ? held.slice(0, half) : held, heldB = held.length > 2 ? held.slice(half) : [];
  const note = `One swatch per tracked brand's accent, darkest first. A work holds an accent when one of its colours over ${Math.round(WORK_MIN_SHARE * 100)}% of the picture is within ${HELD_DISTANCE} of it (OKLab distance).`;
  // The detail figures carry the rule in one line, so a figure with its pairs still fits a laptop screen beside the text.
  const short = `Held: a colour over ${Math.round(WORK_MIN_SHARE * 100)}% of the picture within ${HELD_DISTANCE} of the accent (OKLab distance).`;
  const fig = (title: string, rs: FamilyRow<W>[], pairs: boolean, n = note): DriftFig => ({ kind: "drift", title, note: n, scope: "All tracked brands", rowHead: "Colour family", bands: rs.map(r => band(r, pairs)) });
  const figures: Record<string, DriftFig> = { families: fig("Each colour family's brand accents, most held first", rows, false) };
  if (heldA.length) figures["held"] = fig(heldB.length ? "The colours the stored works hold most" : "The colours the stored works hold", heldA, true, short);
  if (heldB.length) figures["held-less"] = fig("The colours the stored works hold less often", heldB, true, short);
  if (none.length) figures["none"] = fig("The colours no stored work holds", none, false, short);
  const figOf = (r: FamilyRow<W>) => (heldA.includes(r) ? "held" : heldB.includes(r) ? "held-less" : "none");
  const cnt = (v: number, h: string) => num(String(v), v, h);
  const museums = (Object.keys(MUSEUM_NAME) as ArtSource[]).filter(s => works.some(w => w.source === s)).map(s => MUSEUM_NAME[s]);
  const date = art.through ? dayText(art.through) : "—";
  const steps: Step[] = [];
  const smallText: Seg[] = small.length ? [` ${joinOr(small.map(r => `${familyLabel(r.family)} (${r.total})`))} ${small.length === 1 ? "has" : "have"} too few accents for a row.`] : [];
  steps.push({ id: "intro", caption: [...cap`${cnt(f.vivid, "/brands")} of ${cnt(brands.length, "/brands")} tracked brands have a vivid accent colour. Each one is set against every colour that ${cnt(f.works, href)} public-domain works hold, from ${ref(joinAnd(museums), href)}.`, ...smallText], view: { figure: "families", highlight: [] } });
  for (const r of rows) {
    const fam = ref(familyLabel(r.family), href), base = cap`${fam}: ${cnt(r.held, href)} of ${cnt(r.total, href)} brand accents have a near work.`;
    if (!r.held) { steps.push({ id: `family-${r.family}`, caption: [...base, ` ${NONE_HELD}`], view: { figure: figOf(r), highlight: [], focus: familyLabel(r.family) } }); continue; }
    const ex: Seg[] = r.pairs.flatMap((p, k) => { const h = p.nearest!; return [k ? "; " : " For example: ", ref(p.domain, brandHref(p.domain)), " and ", ref([h.work.artist, h.work.title].filter(Boolean).join(", "), h.work.link), ", where the colour holds ", num(`${Math.round(h.colour.share * 100)}%`, h.colour.share, h.work.link), " of the picture"]; });
    steps.push({ id: `family-${r.family}`, caption: [...base, ...ex, "."], view: { figure: figOf(r), highlight: [], focus: familyLabel(r.family) } });
  }
  steps.push({ id: "caveat", caption: ["Held is a measured distance between two colours, read from photographs of the works. It says nothing about influence, and nothing about painting beyond these stored works."], view: { figure: "families", highlight: [] } });
  const emptyTotal = none.reduce((a, r) => a + r.total, 0), top = rows[0];
  const key = none.length >= 2 ? { n: `0 of ${emptyTotal}`, label: `brand ${joinOr(none.map(r => r.family))} accents a stored work holds` }
    : top ? { n: `${top.held} of ${top.total}`, label: `brand ${top.family} accents a stored work holds` } : { n: "—", label: "brand accents a stored work holds" };
  const others = f.works - f.paintings - f.prints;
  const deck = `${f.vivid} tracked brands' accent colours, one at a time, against ${f.works} public-domain works from ${joinAnd(museums)}.`;
  return model(m, i, figures, steps,
    { brands: f.vivid, captures: f.vivid, period: date,
      rule: `A brand's accent is the accent colour measured on its newest live desktop homepage capture. It counts only when it is vivid: OKLCH chroma ${ACCENT_MIN_CHROMA} or more, lightness between ${ACCENT_MIN_L} and ${ACCENT_MAX_L} (not near-black, not near-white). A work holds an accent when one of its colours covering at least ${Math.round(WORK_MIN_SHARE * 100)}% of the picture is within ${HELD_DISTANCE} of it in OKLab distance, close enough that the two read as the same colour side by side at swatch size. The nearest work is shown; a tie goes to the larger share.`,
      lines: [`${f.works} works: ${f.paintings} paintings and ${f.prints} prints${others > 0 ? `, and ${others} other works` : ""}, from ${joinAnd(museums)}, each marked public domain (CC0) by the museum, as stored on ${date}.`,
        "These are photographs of the works. Old pigments fade and darken and varnish yellows, so a work's colours today are not always the colours it was made in.",
        "A screen can show colours that no pigment in these works reaches."] },
    key,
    { scenes: [
        { id: "intro", lead: "One colour from each brand", steps: ["intro"] },
        { id: "held", lead: heldB.length ? "The colours the works hold most" : "The colours the works hold", steps: heldA.map(r => `family-${r.family}`) },
        { id: "held-less", lead: "Held less often", steps: heldB.map(r => `family-${r.family}`) },
        { id: "none", lead: "The colours they do not hold", steps: none.map(r => `family-${r.family}`) },
        { id: "limits", lead: "What held means", steps: ["caveat"] },
      ],
      limits: ["Held is a measured distance between two colours; it says nothing about influence.", "These are photographs of old works: pigments fade and varnish yellows.", `Only the ${f.works} stored works are read, not the museums' whole collections.`],
      fallback: f.title,
      ranked: [{ label: "Colour families, most held first", order: rows.map(r => familyLabel(r.family)) }] },
    { deck });
}
