// BRAND object: one Read page per tracked site, built from stored rows (the audit's single-site model plus its full move history). Pure.
import { READ_TAPE, readTapeShows, tapeLine } from "./tape";
import { reversalIds } from "./reversal";
import { auditModel, traitsOf, type AuditRows, type TraitRef } from "./agency/audit";
import { rebrandSentence, EVENT_KIND, FIELD, type EventRow } from "./agency/changes";
import { identityLabel, isRebrand } from "./rebrand-rule";
import { flipRuns, flipSentence, type FlipIn } from "./flips";
import { basis, label, sectorName, stageName, type Basis, type Dimension, type StageName } from "./labels";
import { OBJECT_BLOCKS, brandPath, consoleHref, signalPath, type Block } from "./ia";
import type { Tier } from "./tiers";
import type { Thumb } from "./thumbs";
import { heroRevealFor } from "./pictures";
import { CROP_SECTIONS, beforeAfterAt, latestSections, toCrop, versionsOf, type Crop, type CropRow, type CropSection } from "./crops";
import { changeSection } from "./evidence-map";
import type { SimilarResult } from "./similar";
import type { BeforeAfterFig, FieldFig } from "./data-stories/types";
import { beforeAfter, type CaptureRaw } from "./data-stories/templates/frames";
import { capturePair, FRAME_LABEL } from "./stories/frames";
import { firstScreen } from "./gallery";

export type BrandPeer = { domain: string; name: string | null; sector: string; traits: string[] };
export type ContrastItem = { key: string; name: string; sector: { v: number; n: number } };
export type BrandRows = { domain: string; audit: AuditRows; events: EventRow[]; /** Event ids changed on a seasonal capture (promo.ts): labelled, never hidden. */ seasonal?: number[]; /** E2c · event ids that are carousel rotations (carousel.ts): labelled Carousel. */ carousel?: number[]; peers: BrandPeer[]; tiers: [string, Tier][]; /** source id ("event:12", "rebrand:<domain>:<at>") → story path, when a story tells it. */ storyOf?: [string, string][]; /** This brand's stored section crops (any order). */ crops?: CropRow[];
  /** Stored home/desktop captures of this brand (skeletons), for the before/after pair either side of each move. */ captures?: CaptureRaw[];
  /** Similar brands (similar.ts), the sector's brand field and the "where you sit" contrast (data-stories/stories.ts). */ similar?: SimilarResult; field?: FieldFig | null; contrast?: { has: ContrastItem[]; lacks: ContrastItem[] } | null };
export type BrandTag = { key: string; name: string; basis: Basis; kind: "aesthetic" | "imagery" | "tone" | "theme" };
export type BrandShow = { key: string; name: string; dimension: Dimension; basis: Basis; stage: StageName | null; tier: Tier; href: string };
export type Face = { family: string; google: boolean; size: number | null; css: string | null };
export type LayoutFact = { id: "theme" | "hero" | "h1" | "whitespace"; label: string; value: string };
export type Move = { id: string; at: string; kind: string; text: string; basis: Basis; href: string; story: boolean; rebrand: boolean; seasonal: boolean; /** Changed back within seven days, or the change back (reversal.ts): labelled, never hidden. */ reversed: boolean; section: CropSection | null; compare: { before: Crop; after: Crop } | null; pair: BeforeAfterFig | null; pairShared: boolean;
  /** A back-and-forth run folded into this one row (flips.ts); its single moves sit behind a disclosure. */ folded?: Move[] };
export type BrandPage = {
  domain: string; name: string; sector: string | null; sectorName: string; tracked: boolean; captured: string | null; lastMove: { text: string; at: string } | null; thumb: Thumb | null;
  identity: { h1: Face | null; body: Face | null; theme: string | null; accent: { hex: string; name: string } | null; palette: { hex: string; name: string; share: number | null }[]; tags: BrandTag[]; layout: LayoutFact[]; receipt: string };
  timeline: Move[];
  /** The sector's brand field with this brand marked, and the headline signals it has that its sector mostly lacks (and the reverse). */
  field: FieldFig | null; contrast: { has: ContrastItem[]; lacks: ContrastItem[] } | null;
  similar: SimilarResult;
  /** Latest crop of each section that exists, and every stored version per section (newest first) for the history view. */
  sections: (Crop & { versions: number })[]; history: Record<CropSection, Crop[]>;
  versus: { scope: string; scopeName: string; ahead: TraitRef[]; behind: TraitRef[] } | null;
  soWhat: string;
  shows: BrandShow[];
  actions: { watch: string; compare: string; audit: string | null; differentiate: string; recommendType: string | null; terminal: string };
  blocks: readonly Block[];
};
export const TIMELINE_MAX = 40;
/** At most this many moves carry a redrawn before/after pair (the newest first), so a long history stays light. */
export const MOVE_PAIRS_MAX = 8;
/** Faces a reader already has without fetching anything: the brand's own three, and the core faces every system ships. */
const SHIPPED: Record<string, string> = { "big shoulders": "var(--tk-font-display)", "big shoulders display": "var(--tk-font-display)", newsreader: "var(--tk-font-text)", "ibm plex mono": "var(--tk-font-mono)" };
const SYSTEM: Record<string, string> = { arial: "Arial, sans-serif", helvetica: "Helvetica, Arial, sans-serif", "helvetica neue": "\"Helvetica Neue\", Helvetica, Arial, sans-serif", georgia: "Georgia, serif", "times new roman": "\"Times New Roman\", Times, serif", times: "Times, serif", verdana: "Verdana, sans-serif", "courier new": "\"Courier New\", monospace", "system-ui": "system-ui, sans-serif", "-apple-system": "system-ui, sans-serif", "sans-serif": "sans-serif", serif: "serif", monospace: "monospace" };
/** next/font and similar build tools rename faces ("__Inter_a1b2c3"); compare on the plain name. */
export const plainFace = (family: string) => family.replace(/^_+/, "").replace(/_(?:[0-9a-f]{5,}|Fallback.*)$/i, "").replace(/_/g, " ").replace(/^["']|["']$/g, "").trim();
/** The CSS family to set a face in on the page, or null when showing it would mean fetching a font (the name is shown alone). */
export function showableFace(family: string): string | null {
  const k = plainFace(family).toLowerCase();
  return SHIPPED[k] ?? SYSTEM[k] ?? null;
}
/** One type line, only what a reader needs: the face, its size and where it comes from ("Inter · 56px · Google Fonts"). */
export function faceLine(f: Face): string {
  const from = f.google ? "Google Fonts" : SYSTEM[plainFace(f.family).toLowerCase()] ? "System font" : null;
  return [f.family, f.size != null ? `${Math.round(f.size)}px` : null, from].filter(Boolean).join(" · ");
}
const withoutFolded = <T extends { folded?: unknown }>({ folded: _f, ...m }: T) => m;
/** The newest move with captures to compare shows them open; every later one keeps them behind its row's disclosure. */
/** Folds each back-and-forth run (one scalar field swapping two values within FLIP_DAYS) into one row placed where its newest move was. */
export function foldFlips<M extends { id: string; at: string }>(moves: M[], events: readonly EventRow[]): (M & { folded?: M[] })[] {
  const ins: FlipIn[] = events.flatMap(e => {
    const b = e.before && typeof e.before === "object" ? (e.before as Record<string, unknown>) : {}, a = e.after && typeof e.after === "object" ? (e.after as Record<string, unknown>) : {};
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
    if (keys.length !== 1 || typeof b[keys[0]!] !== "string" || typeof a[keys[0]!] !== "string") return [];
    return [{ id: `event:${e.id}`, field: keys[0]!, before: b[keys[0]!] as string, after: a[keys[0]!] as string, at: e.effective_at ?? e.detected_at }];
  });
  const byId = new Map(moves.map(m => [m.id, m])), out: (M & { folded?: M[] })[] = [], taken = new Set<string>();
  const runs = flipRuns(ins).filter(r => r.ids.every(id => byId.has(id)));
  const head = new Map<string, (typeof runs)[number]>();
  for (const r of runs) { const members = r.ids.map(id => byId.get(id)!).sort((x, y) => y.at.localeCompare(x.at)); head.set(members[0]!.id, r); r.ids.forEach(id => taken.add(id)); }
  for (const m of moves) {
    const r = head.get(m.id);
    if (r) {
      const members = r.ids.map(id => byId.get(id)!).sort((x, y) => y.at.localeCompare(x.at));
      out.push({ ...m, id: `flip:${r.field}:${r.ids[0]}`, kind: "Back and forth", text: flipSentence(r, FIELD[r.field] ?? r.field.replace(/_/g, " ")), compare: null, folded: members } as M & { folded: M[] });
    } else if (!taken.has(m.id)) out.push(m as M & { folded?: M[] });
  }
  return out;
}
export const openPairId = (moves: readonly Pick<Move, "id" | "compare" | "pair">[]) => moves.find(m => m.compare || m.pair)?.id ?? null;
const HERO: Record<string, string> = { video: "Video", image: "Image", illustration: "Illustration", "3d": "3D", product: "Product shot", none: "Text only", text: "Text only", canvas: "Canvas" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Ahead of its sector on 3 rising signals; still using 1 fading one." Deterministic, from the audit's ahead/behind lists. */
export function brandSoWhat(ahead: number, behind: number, where = "its sector"): string {
  if (!ahead && !behind) return `Neither ahead of nor behind ${where} on any signal we stage right now.`;
  const a = ahead ? `Ahead of ${where} on ${plural(ahead, "rising signal")}` : `Not ahead of ${where} on any rising signal`;
  const b = behind ? `still using ${behind === 1 ? "1 fading one" : `${behind} fading ones`}` : "using no fading ones";
  return `${a}; ${b}.`;
}

/** What the Moves list needs (the brand page reads it in its own deferred section). */
export type MovesRows = { domain: string; name: string; events: EventRow[]; rebrands: AuditRows["rebrands"]; seasonal: number[]; carousel?: number[]; storyOf: [string, string][]; crops: CropRow[]; captures: CaptureRaw[] };
/** The brand's moves, newest first: every live change and confirmed rebrand, back-and-forth runs folded, before/after where it exists. */
export function brandTimeline(r: MovesRows): Move[] {
  const d = r.domain;
  const stories = new Map(r.storyOf), link = (src: string) => { const h = stories.get(src); return h ? { href: h, story: true } : { href: `/brands/${d}?view=data`, story: false }; };
  const crops = r.crops.filter(c => c.domain === d);
  // A timeline entry shows before/after only when two versions of its section sit on either side of the change (effective time).
  const compareAt = (section: CropSection | null, pivot: string) => { if (!section) return null; const p = beforeAfterAt(versionsOf(crops, d, section), pivot); return p ? { before: toCrop(p.before), after: toCrop(p.after) } : null; };
  const fieldsOf = (e: EventRow) => Object.keys({ ...(e.before && typeof e.before === "object" ? e.before : {}), ...(e.after && typeof e.after === "object" ? e.after : {}) });
  const caps = r.captures, usedPairs = new Set<string>();
  let pairs = 0;
  const pairAt = (pivot: string, compare: unknown): { pair: BeforeAfterFig | null; pairShared: boolean } => {
    if (compare || !caps.length) return { pair: null, pairShared: false };
    const p = capturePair(caps, pivot); if (!p) return { pair: null, pairShared: false };
    const k = `${p.before.id}:${p.after.id}`;
    if (usedPairs.has(k)) return { pair: null, pairShared: true };
    if (pairs >= MOVE_PAIRS_MAX) return { pair: null, pairShared: false };
    const fig = beforeAfter({ title: "Before → after", note: `${FRAME_LABEL}: the two captures either side of the change, in their own colours. No screenshot is stored.`, domain: d, name: r.name, a: p.before, b: p.after, crops: [] });
    if (!fig.before.boxes.length || !fig.after.boxes.length) return { pair: null, pairShared: false };
    usedPairs.add(k); pairs++;
    // Side by side in the column, each cut to the first screen, so a move's pair stays about one screen tall.
    // I1: each drawing can reveal the brand's real hero crop (the one current at its capture), requested only on intent.
    return { pair: { ...fig, before: { ...firstScreen(fig.before), reveal: heroRevealFor(crops, d, fig.before.at) }, after: { ...firstScreen(fig.after), reveal: heroRevealFor(crops, d, fig.after.at) } }, pairShared: false };
  };
  const seasonalSet = new Set(r.seasonal), carouselSet = new Set(r.carousel ?? []), reversedSet = reversalIds(r.events.filter(e => e.domain === d).map(e => ({ ...e, page_type: e.page_type ?? null, viewport: e.viewport ?? null })));
  const raw: (Omit<Move, "pair" | "pairShared" | "folded"> & { pivot: string })[] = [
    ...r.events.filter(e => e.domain === d && readTapeShows(e)).map(e => { const section = changeSection({ kind: "event", type: e.type, fields: fieldsOf(e) }); return { id: `event:${e.id}`, at: e.detected_at, pivot: e.effective_at ?? e.detected_at, kind: EVENT_KIND[e.type] ?? "Change", text: tapeLine(e, { seasonal: seasonalSet.has(e.id), reversed: reversedSet.has(e.id), carousel: carouselSet.has(e.id) }, r.name, READ_TAPE), basis: (e.type === "imagery_shift" || e.type === "aesthetic_shift" ? "ai" : "measured") as Basis, ...link(`event:${e.id}`), rebrand: false, seasonal: seasonalSet.has(e.id), reversed: reversedSet.has(e.id), section, compare: compareAt(section, e.effective_at ?? e.detected_at) }; }),
    ...r.rebrands.filter(x => x.domain === d).map(x => { const section = changeSection({ kind: "rebrand", reasons: x.reasons }); return { id: `rebrand:${x.confirmed_at}`, at: x.confirmed_at, pivot: x.effective_at ?? x.confirmed_at, kind: identityLabel(x), text: `${rebrandSentence(x)}. ${x.read}`, basis: "measured" as Basis, ...link(`rebrand:${d}:${x.confirmed_at}`), rebrand: isRebrand(x), seasonal: !!x.seasonal, reversed: false, section, compare: compareAt(section, x.effective_at ?? x.confirmed_at) }; }),
  ].sort((x, y) => y.at.localeCompare(x.at) || x.id.localeCompare(y.id)).slice(0, TIMELINE_MAX);
  return foldFlips(raw, r.events.filter(e => e.domain === d)).map(({ pivot, ...m }) => (m.folded ? { ...m, pair: null, pairShared: false, folded: m.folded.map(({ pivot: _p, ...x }) => ({ ...x, pair: null, pairShared: false })) } : { ...withoutFolded(m), ...pairAt(pivot, m.compare) }));
}
/** Sections strip and per-section history from this brand's crops. */
export function brandSections(crops: CropRow[], d: string): Pick<BrandPage, "sections" | "history"> {
  const own = crops.filter(c => c.domain === d);
  return { sections: latestSections(own, d), history: Object.fromEntries(CROP_SECTIONS.map(s => [s, versionsOf(own, d, s).map(toCrop)])) as Record<CropSection, Crop[]> };
}
/** The part of the brand page a page sends first: the identity card, the head's line and what needs no list (P1). */
export type BrandCard = Omit<BrandPage, "timeline" | "sections" | "history" | "field" | "contrast" | "similar">;
export const cardOf = ({ timeline: _t, sections: _s, history: _h, field: _f, contrast: _c, similar: _m, ...card }: BrandPage): BrandCard => card;

export function brandModel(r: BrandRows): BrandPage {
  const a = auditModel(r.audit), d = r.domain, site = r.audit.sites.find(s => s.domain === d) ?? null, g = a.glance[0]!;
  const tiers = new Map(r.tiers), shown = (k: string) => { const t = tiers.get(k); return t === "headline" || t === "supporting"; };
  const sector = site?.site?.sector ?? null, scope = sector && r.audit.forecasts.some(f => f.scope === sector) ? sector : "all";
  const type = a.type?.sites.find(s => s.domain === d) ?? null, color = a.color?.sites.find(s => s.domain === d) ?? null, vibe = a.vibe?.sites.find(s => s.domain === d) ?? null;
  const tags: BrandTag[] = [
    ...(color?.theme ? [{ key: `theme:${color.theme}`, name: label(`theme:${color.theme}`).name, basis: basis(`theme:${color.theme}`), kind: "theme" as const }] : []),
    ...(["aesthetic", "imagery", "tone"] as const).flatMap(kind => (vibe?.[kind] ?? []).map(v => ({ key: `${kind}:${v}`, name: label(`${kind}:${v}`).name, basis: basis(`${kind}:${v}`), kind }))),
  ];
  const timeline = brandTimeline({ domain: d, name: site?.site?.name ?? d, events: r.events, rebrands: r.audit.rebrands, seasonal: r.seasonal ?? [], carousel: r.carousel ?? [], storyOf: r.storyOf ?? [], crops: r.crops ?? [], captures: r.captures ?? [] });
  const crops = (r.crops ?? []).filter(c => c.domain === d);
  const history = Object.fromEntries(CROP_SECTIONS.map(s => [s, versionsOf(crops, d, s).map(toCrop)])) as Record<CropSection, Crop[]>;
  const m = a.market?.sites.find(s => s.domain === d) ?? null;
  const versus = m ? { scope: m.scope, scopeName: sectorName(m.scope), ahead: m.ahead.filter(x => shown(x.trait)), behind: m.behind.filter(x => shown(x.trait)) } : null;
  const where = versus && versus.scope !== "all" ? "its sector" : "all sectors";
  const self = r.peers.find(p => p.domain === d), mine = new Set((self?.traits ?? (site ? traitsOf(site) : [])).filter(shown));
  const similar: SimilarResult = r.similar ?? { items: [], enough: false, basis: 0, line: "Similar brands are not available right now." };
  const fc = new Map(r.audit.forecasts.filter(f => f.scope === scope).map(f => [`${f.dimension}:${f.value}`, f]));
  const order: Record<Tier, number> = { headline: 0, supporting: 1, archive: 2 };
  const shows = [...mine].map(k => { const l = label(k); return { key: k, name: l.name, dimension: l.dimension, basis: basis(k), stage: stageName(fc.get(k)?.stage), tier: tiers.get(k) ?? "supporting", href: signalPath(k) }; })
    .sort((x, y) => order[x.tier] - order[y.tier] || x.name.localeCompare(y.name));
  const peers = similar.items.slice(0, 2).map(p => p.domain);
  const h1 = type?.h1 ?? null, body = type?.body ?? null, lay = a.layout?.sites.find(x => x.domain === d) ?? null, ws = site?.history?.whitespace_ratio ?? null;
  const layout: LayoutFact[] = [
    ...(color?.theme ? [{ id: "theme" as const, label: "Theme", value: label(`theme:${color.theme}`).name }] : []),
    ...(lay?.heroMedia ? [{ id: "hero" as const, label: "Hero media", value: HERO[lay.heroMedia] ?? lay.heroMedia.replace(/_/g, " ") }] : []),
    ...(h1?.size != null ? [{ id: "h1" as const, label: "Headline size", value: `${Math.round(h1.size)}px` }] : []),
    ...(typeof ws === "number" && Number.isFinite(ws) ? [{ id: "whitespace" as const, label: "White space", value: `${Math.round(ws * 100)}%` }] : []),
  ];
  const face = (f: typeof h1): Face | null => f ? { family: plainFace(f.family), google: f.google, size: f.size, css: showableFace(f.family) } : null;
  const palette = (color?.palette ?? []).map(p => ({ hex: p.hex, name: p.name, share: p.share })).sort((x, y) => (y.share ?? -1) - (x.share ?? -1));
  return {
    domain: d, name: site?.site?.name ?? d, sector, sectorName: sectorName(sector), tracked: g.status === "tracked", captured: g.captured, lastMove: timeline[0] ? { text: timeline[0].text, at: timeline[0].at } : g.latest, thumb: g.thumb,
    identity: { h1: face(h1), body: face(body), theme: color?.theme ?? null, accent: color?.accent ?? null, palette, tags, layout, receipt: `/brands/${d}?view=data` },
    field: r.field ?? null, contrast: r.contrast ?? null, similar,
    timeline, sections: latestSections(crops, d), history, versus, soWhat: versus ? brandSoWhat(versus.ahead.length, versus.behind.length, where) : "Not enough measured data on this brand yet to compare it with its sector.",
    shows,
    actions: { watch: `/watch/new?add=${encodeURIComponent(d)}&name=${encodeURIComponent(`${site?.site?.name ?? d} watch`)}`, compare: `/audit/new?sites=${encodeURIComponent(d)}`, audit: peers.length ? `/audit?sites=${[d, ...peers].sort().join(",")}` : null,
      differentiate: consoleHref(`diff https://${d}`), recommendType: sector ? consoleHref(`type ${sector} headline any`, sector) : null, terminal: `/brands/${d}?view=data` },
    blocks: OBJECT_BLOCKS,
  };
}
