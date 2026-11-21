// PHASE E2a · THE EDITOR'S CALL — what may become a story. Pure: same rows in, same candidates (and ids) out.
// Three tiers: every confirmed change is a tape line (tape.ts); a story must be a positioning change, an identity change, a headline
// typeface change, a pattern (roundup, breakout, crossover, white space, shift, first seen), the weekly seasonal story or the weekly
// against-the-grain roundup; outside news keeps its own rules. Changes to one brand inside seven days are one story.
import { quietCandidates, type QuietVerdict } from "./quiet";
import { basis, label, sectorName, stageName } from "../labels";
import type { EventRow } from "../agency/changes";
import { brandName, nameText, siteKind, type SiteKind } from "../brand-names";
import { brandPath, patternPath, signalPath } from "../ia";
import { pct } from "../digest/copy";
import { isoWeek } from "../digest/week";
import { normalizeFont } from "../library-diff";
import { promoWording, seasonalEventIds } from "../promo";
import { isRebrand, REBRAND_LABEL } from "../rebrand-rule";
import { REVERSED_REASON, reversalIds } from "../reversal";
import { changeAt, changeFrom, changeWhen, rangeWords, tapeDate, tapeLine, tapeWhat, undated } from "../tape";
import { censusCandidates } from "../census";
import { codeCall, headlineOf, HEADLINE_CALL_NAME, UNCLEAR_HOLD, type HeadlineCallClass } from "./headline-call";
import { carouselEventIds, isShowcaseSector, withoutRotations } from "../carousel";
import { splitChecked, type Condition } from "../integrity";
import {
  breakoutCandidates, context, counterMoveCandidates, crossoverCandidates, firstSeenCandidates, inline, isVisibleMove, launchCandidate, moveCandidate,
  newsCandidates, newsMatcher, noDollar, shiftCandidates, traitDelta, whiteSpaceCandidates, type BuildInput, type Ctx, type NewsDrops,
} from "./candidates";
import { AI_EVENTS, COUNTER_HELD_REASON, countWord, ESTIMATE_ONLY_REASON, ROUNDUP_MIN, WHITE_SPACE_NOT_APPLICABLE, type Candidate, type Fact } from "./types";

const DAY = 864e5;
/** Changes to one brand within this many days of its first change are one story (Part 3). */
export const GROUP_DAYS = 7;
/** Roundups, the seasonal story and the against-the-grain roundup look at this many days. */
export const PATTERN_DAYS = 7;
/** The seasonal story and the against-the-grain roundup need this many brands. */
export const SEASONAL_STORY_MIN = 3, AGAINST_MIN = 3;
/** A stage change runs as a story only on at least this share of tracked homepages; below it, the Digest's Brief table carries it. */
export const SHIFT_MIN_SHARE = 0.1;
export const SHIFT_BRIEF_REASON = `Brief table only: on under ${Math.round(SHIFT_MIN_SHARE * 100)}% of tracked homepages`;
/** Signals that answer one question together: their stage changes from one run pair are one story. */
export const SHIFT_FAMILIES = new Set(["ai_positioning"]);
export const TAPE_REASON = "Tape line: not a positioning, identity or headline typeface change";
export { WHITE_SPACE_NOT_APPLICABLE };
export const notApplicable = (sector: string, key: string) => WHITE_SPACE_NOT_APPLICABLE[sector]?.[key] ?? null;

// TYPEFACES -------------------------------------------------------------------------------------------------------------------------
/** Weight, width, style, foundry and script words that name a cut of a family, not a family ("Söhne Breit Extrafett" → "söhne"). */
const CUT_WORDS = new Set(["thin", "hairline", "extralight", "ultralight", "light", "book", "regular", "normal", "roman", "text", "medium", "semibold", "demibold", "demi", "bold", "extrabold", "ultrabold", "black", "heavy", "extrafett", "fett", "halbfett", "kräftig", "leicht", "buch", "breit", "schmal", "condensed", "compressed", "narrow", "extended", "expanded", "wide", "italic", "oblique", "variable", "vf", "pro", "std", "pt", "ll", "mt", "web", "cyr", "db", "display", "headline", "caption", "subhead", "neue"]);
/** Generic or system families: a change to or from one of these is a fallback, not a typeface choice. */
const FALLBACKS = new Set(["", "sans-serif", "serif", "monospace", "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui", "arial", "helvetica", "helvetica neue", "times", "times new roman", "georgia", "inherit", "initial", "none", "ui-sans-serif", "ui-serif"]);
/** The family a font name belongs to, without cut words, numbers or hashes. */
export function typefaceFamily(name: unknown): string {
  // Quotes, next/font hashes ("__Inter_a1b2c3", "Inter Fallback") and file-name joins go first; then cut words and numbers.
  const n = String(name ?? "").split(",")[0]!.toLowerCase().replace(/["']/g, "").replace(/^_+/, "").replace(/_[a-f0-9]{5,}\b/g, "").replace(/\bfallback\b/g, "").replace(/[_-]+/g, " ");
  return n.split(/\s+/).filter(w => w && !CUT_WORDS.has(w) && !/^\d+$/.test(w)).join(" ");
}
/** The headline font family itself changed (not a fallback, a weight or a width). */
export function isTypefaceChange(before: unknown, after: unknown): boolean {
  const b = String(before ?? "").trim(), a = String(after ?? "").trim();
  if (FALLBACKS.has(b.toLowerCase()) || FALLBACKS.has(a.toLowerCase())) return false;
  const fb = typefaceFamily(b), fa = typefaceFamily(a);
  // Same family once cut words and hashes are gone, or the same font file renamed (library-diff's own font equality).
  return !!fb && !!fa && fb !== fa && normalizeFont(fb) !== normalizeFont(fa);
}

// CHANGES -> DIMENSIONS ------------------------------------------------------------------------------------------------------------
export type Dim = "type" | "colour" | "layout" | "headline";
export type Change = { e: EventRow; kind: SiteKind; dims: Dim[]; typeface: boolean; position: boolean; rebrandReasons: string[]; things: string[] };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const isHome = (e: Pick<EventRow, "page_type">) => !e.page_type || e.page_type === "home";
/**
 * What one confirmed homepage change counts as toward a story on this kind of site. Merchandised and editorial homepages keep only typeface
 * and headline alignment (their palette, hero and headline follow promotions or the day's lead story). On a showcase homepage (a studio,
 * E2d) palette, accent and hero follow the featured client work and are treated the same way; its fonts, headline and alignment count.
 */
export function changeOf(e: EventRow, kind: SiteKind, call: HeadlineCallClass | null, o2: { showcase?: boolean } = {}): Change {
  const b = o(e.before), a = o(e.after), dims = new Set<Dim>(), reasons = new Set<string>(), things: string[] = [];
  let typeface = false, position = false;
  const standard = kind === "standard", ownColour = standard && !o2.showcase;
  if (e.type === "type_change") {
    if (("h1" in a || "h1" in b) && isTypefaceChange(b["h1"], a["h1"])) { typeface = true; dims.add("type"); reasons.add("font"); things.push("headline typeface"); }
    if (standard && ("body" in a || "body" in b) && isTypefaceChange(b["body"], a["body"])) { dims.add("type"); reasons.add("font"); things.push("body font"); }
  } else if (ownColour && e.type === "palette_shift") {
    dims.add("colour");
    if ("accent" in a || "accent" in b) { reasons.add("accent"); things.push("accent"); }
    if ("palette" in a || "palette" in b) { reasons.add("palette"); things.push("palette"); }
  } else if (standard && e.type === "theme_flip") {
    // A theme flip is its own rebrand dimension (rebrand-rule.ts) but not one of the four identity dimensions (type, colour, layout, headline).
    reasons.add("theme"); things.push("theme");
  }
  else if (e.type === "layout_change") {
    if (ownColour && ("hero_media" in a || "hero_media" in b)) { dims.add("layout"); reasons.add("redesign"); things.push("hero"); }
    if ("h1_align" in a || "h1_align" in b) { dims.add("layout"); reasons.add("redesign"); things.push("headline alignment"); }
  } else if (standard && e.type === "message_pivot" && call === "position") { position = true; dims.add("headline"); things.push("headline"); }
  return { e, kind, dims: [...dims], typeface, position, rebrandReasons: [...reasons], things };
}

const listOf = (xs: string[], n = 4) => (xs.length <= 1 ? xs.join("") : xs.length <= n ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : `${xs.slice(0, n).join(", ")} and ${xs.length - n} more`);
const sortByTime = <T extends { e: EventRow }>(xs: T[]) => [...xs].sort((a, b) => a.e.detected_at.localeCompare(b.e.detected_at) || a.e.id - b.e.id);
/** Anchored windows: a cluster starts at its first item and holds every item within `days` of it; the next item starts a new one. */
export function clusters<T>(items: T[], at: (x: T) => string, days: number): T[][] {
  const out: T[][] = [];
  for (const x of [...items].sort((a, b) => at(a).localeCompare(at(b)))) {
    const cur = out.at(-1);
    if (cur && Date.parse(at(x)) - Date.parse(at(cur[0]!)) < days * DAY) cur.push(x); else out.push([x]);
  }
  return out;
}

// PART 4 · THE NUMBER THAT GIVES A STORY MEANING -----------------------------------------------------------------------------------
const AI_WORDS = /(?<![\p{L}\p{N}])(?:AI|A\.I\.|artificial intelligence|agents?|agentic|copilots?|LLMs?)(?![\p{L}\p{N}])/u;
/** Signals a change relates to, best first: AI positioning when a headline mentions AI, then the traits the change gained and dropped. */
export function relatedSignals(changes: Change[]): string[][] {
  const out: string[][] = [];
  if (changes.some(c => c.position && [headlineOf(c.e.before), headlineOf(c.e.after)].some(h => !!h && AI_WORDS.test(h)))) out.push(["ai_positioning:ai_core", "ai_positioning:ai_feature"]);
  for (const c of changes) { const d = traitDelta(c.e); for (const k of [...d.gained, ...d.dropped]) out.push([k]); }
  return out;
}
/** One library figure for a single-brand story: the related signal's current share and stage, in the brand's sector or across the library, whichever has the larger base. */
export function contextFigure(ctx: Ctx, changes: Change[], sector: string | null): { fact: Fact; keys: string[] } | null {
  const base = (scope: string) => (scope === "all" ? ctx.sites.length : ctx.bySector.get(scope)?.length ?? 0);
  const scope = sector && base(sector) > base("all") ? sector : "all";
  for (const keys of relatedSignals(changes)) {
    const rows = keys.map(k => ({ k, r: ctx.row(ctx.cur, k, scope) })).filter(x => x.r?.status === "ok" && x.r.current_share != null);
    if (rows.length !== keys.length || !rows.length) continue;
    const where = scope === "all" ? "tracked homepages" : `tracked ${inline(sectorName(scope))} homepages`;
    const text = rows.map(({ k, r }, i) => `${i === 0 ? label(k).name : inline(label(k).name)} ${i === 0 ? "is on" : "on"} ${pct(r!.current_share, 1)}${i === 0 ? ` of ${where}` : ""}${stageName(r!.stage) ? ` (${stageName(r!.stage)})` : ""}`).join("; ");
    return { fact: { text, href: signalPath(rows[0]!.k), basis: basis(rows[0]!.k), kind: "share" }, keys };
  }
  return null;
}

// SINGLE-BRAND STORIES -------------------------------------------------------------------------------------------------------------
export type BrandGroup = { id: string; domain: string; sector: string | null; kind: SiteKind; start: string; changes: Change[]; qualifiedAt: string | null };
const qualifies = (kind: SiteKind, cs: Change[]) => {
  if (cs.some(c => c.typeface)) return true;
  if (kind !== "standard") return false;
  return cs.some(c => c.position) || new Set(cs.flatMap(c => c.dims)).size >= 2;
};
/** One brand's story-eligible changes in anchored seven-day windows, and when each window first qualified as a story. */
export function brandGroups(changes: Change[]): BrandGroup[] {
  const by = new Map<string, Change[]>();
  for (const c of changes) if (c.dims.length) by.set(c.e.domain, [...(by.get(c.e.domain) ?? []), c]);
  const out: BrandGroup[] = [];
  for (const [domain, list] of [...by].sort(([a], [b]) => a.localeCompare(b))) {
    for (const cl of clusters(sortByTime(list), c => c.e.detected_at, GROUP_DAYS)) {
      const kind = cl[0]!.kind, i = cl.findIndex((_, k) => qualifies(kind, cl.slice(0, k + 1)));
      out.push({ id: `brand:${domain}:${cl[0]!.e.detected_at.slice(0, 10)}`, domain, sector: cl[0]!.e.sector ?? null, kind, start: cl[0]!.e.detected_at, changes: cl, qualifiedAt: i >= 0 ? cl[i]!.e.detected_at : null });
    }
  }
  return out;
}
/** The story for one brand group: every specific (what, from, to, date), the headline call's reason, and the library figure. */
export function brandStory(ctx: Ctx, g: BrandGroup, calls: Record<number, { call: string; reason: string }>, name?: string | null): Candidate {
  const n = brandName(g.domain, name), cs = sortByTime(g.changes), reasons = [...new Set(cs.flatMap(c => c.rebrandReasons))];
  const rebrand = g.kind === "standard" && isRebrand({ reasons });
  const things = [...new Set(cs.flatMap(c => c.things))];
  const ordered = [...things.filter(t => t === "headline"), ...things.filter(t => t !== "headline")];
  const label0 = rebrand ? REBRAND_LABEL : new Set(cs.flatMap(c => c.dims)).size >= 2 ? "Identity" : cs.some(c => c.position) ? "Positioning" : "Typeface";
  const pos = cs.find(c => c.position), onlyHeadline = ordered.length === 1 && pos;
  const headline = rebrand ? `${n} rebranded: new ${listOf([...ordered.filter(t => t !== "headline"), ...(pos ? ["headline"] : [])], 5)}`
    : onlyHeadline ? `${n} changed its headline to “${headlineOf(pos.e.after) ?? ""}”` : `${n} changed its ${listOf(ordered, 5)}`;
  const brand = brandPath(g.domain), lib = `/library/${encodeURIComponent(g.domain)}`;
  const figure = contextFigure(ctx, cs, g.sector);
  const facts: Fact[] = [
    ...cs.map(c => ({ text: `${tapeWhat(c.e)[0]!.toUpperCase()}${tapeWhat(c.e).slice(1)} · ${changeWhen(c.e)}`, href: brand, basis: AI_EVENTS.has(c.e.type) ? "ai" as const : "measured" as const, kind: "member" as const })),
    ...cs.filter(c => c.position && calls[c.e.id]).map(c => ({ text: `Headline call: ${HEADLINE_CALL_NAME.position.toLowerCase()}. ${calls[c.e.id]!.reason}`, href: lib, basis: null, kind: "source" as const })),
    ...(figure ? [figure.fact] : []),
    { text: `Confirmed on a second capture, ${tapeDate(cs.at(-1)!.e.detected_at)}`, href: lib, basis: "measured", kind: "date" },
  ];
  return {
    id: g.id, type: rebrand ? "rebrand" : "move", kicker: `${label0} · ${g.sector ? sectorName(g.sector) : "Library"}`, headline,
    // E2g: each change is dated by its captures ("between 11 and 14 Nov"), never by the day it was confirmed.
    deck: `${cs.map(c => `${tapeWhat(c.e)} (${changeWhen(c.e)})`).join("; ").replace(/^./, x => x.toUpperCase())}.`,
    facts, sector: g.sector, signalKeys: figure?.keys ?? [], domains: [g.domain],
    evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: lib }], sourceIds: cs.map(c => `event:${c.e.id}`), basis: "measured",
    happenedAt: g.qualifiedAt ?? g.start, magnitude: Math.max(1, new Set(cs.flatMap(c => c.dims)).size + (pos ? 1 : 0) + (cs.some(c => c.typeface) ? 1 : 0)),
  };
}

// WEEKLY GATHERINGS ----------------------------------------------------------------------------------------------------------------
/** E2g · no longer built (the sale-mode census replaced it); kept for its rule tests. The seasonal story: three or more brands seasonal within seven days, at most once a week; its members never run alone. A member's
 *  change must carry the sale wording itself (E2f: its new headline reads as a promotion); other changes on a seasonal page stay tape lines. */
export function seasonalStory(input: Pick<BuildInput, "now">, events: EventRow[], seasonal: Set<number>, names: ReadonlyMap<string, string | null>): Candidate | null {
  const since = Date.parse(input.now) - PATTERN_DAYS * DAY;
  const members = sortByTime(events.filter(e => seasonal.has(e.id) && promoWording(e) !== null && isHome(e) && Date.parse(e.detected_at) >= since && Date.parse(e.detected_at) <= Date.parse(input.now)).map(e => ({ e })));
  const domains = [...new Set(members.map(m => m.e.domain))];
  if (domains.length < SEASONAL_STORY_MIN) return null;
  const week = isoWeek(new Date(input.now)), last = members.at(-1)!.e.detected_at, first = members[0]!.e.detected_at;
  const per = domains.map(d => members.filter(m => m.e.domain === d));
  return {
    id: `seasonal:${week}`, type: "roundup", kicker: "Roundup · Seasonal", headline: `${countWord(domains.length)} brands switched their homepages to seasonal promotions`,
    deck: `${listOf(domains.map(d => brandName(d, names.get(d))), 6)}, ${rangeWords(first, last)}.`,
    facts: per.map(ms => ({ text: tapeLine(ms.at(-1)!.e, { seasonal: true }, names.get(ms[0]!.e.domain)), href: brandPath(ms[0]!.e.domain), basis: "measured" as const, kind: "member" as const })),
    sector: null, signalKeys: [], domains, evidence: domains.slice(0, 4).map(d => ({ label: brandName(d, names.get(d)), href: brandPath(d) })),
    sourceIds: members.map(m => `event:${m.e.id}`), basis: "measured", happenedAt: last, magnitude: domains.length,
  };
}
/** Against the grain names at most this many brands, strongest first; the rest are counted in the last sentence and listed in the facts. */
export const AGAINST_NAMED_MAX = 6;
/**
 * Against the grain (E2c, the approved reading of E2a): once a week, three or more held counter-moves, not reversed, each with a stored
 * stage and share behind its signal, in one piece outside the daily five. Brands that also have a measured change on the tape that week
 * come first, then by trendsetter rank; at most six are named, the rest counted. `measured` is the week's tape (any confirmed live change
 * that is not reversed); it orders the piece and never decides membership.
 */
export function againstTheGrain(ctx: Ctx, counters: Candidate[], reversedIds: Set<string>, measured: EventRow[] = [], eventsById: ReadonlyMap<number, EventRow> = new Map()): Candidate | null {
  const since = Date.parse(ctx.now) - PATTERN_DAYS * DAY, inWeek = (iso: string) => Date.parse(iso) >= since && Date.parse(iso) <= Date.parse(ctx.now);
  const backing = new Map<string, EventRow[]>();
  for (const e of measured) if (inWeek(e.detected_at) && !AI_EVENTS.has(e.type)) backing.set(e.domain, [...(backing.get(e.domain) ?? []), e]);
  const staged = (c: Candidate) => c.signalKeys.every(k => { const s = ctx.stageFor(k, c.sector); const r = ctx.row(ctx.cur, k, s.scope); return r?.current_share != null && !!s.stage; });
  const ok = counters.filter(c => !reversedIds.has(c.id) && inWeek(c.happenedAt) && staged(c));
  const first = new Map<string, Candidate>(); for (const c of [...ok].sort((a, b) => a.happenedAt.localeCompare(b.happenedAt) || a.id.localeCompare(b.id))) if (!first.has(c.domains[0]!)) first.set(c.domains[0]!, c);
  // Strongest first: a measured change on the brand's tape that week, then the brand's trendsetter rank.
  const backed = (d: string) => ((backing.get(d)?.length ?? 0) > 0 ? 1 : 0);
  const picked = [...first.values()].sort((a, b) => backed(b.domains[0]!) - backed(a.domains[0]!) || ((ctx.rank.get(a.domains[0]!) ?? 999) - (ctx.rank.get(b.domains[0]!) ?? 999)) || a.domains[0]!.localeCompare(b.domains[0]!));
  if (picked.length < AGAINST_MIN) return null;
  const week = isoWeek(new Date(ctx.now)), domains = picked.map(c => c.domains[0]!), named = domains.slice(0, AGAINST_NAMED_MAX), rest = domains.length - named.length;
  const byTime = [...picked].sort((a, b) => a.happenedAt.localeCompare(b.happenedAt));
  // E2g: the deck's range runs from the last capture of an old value to the first capture of a new one, where the changes carry them.
  const evOf = (c: Candidate) => c.sourceIds.flatMap(x => { const m = /^event:(\d+)$/.exec(x); const e = m ? eventsById.get(Number(m[1])) : undefined; return e ? [e] : []; });
  const froms = picked.flatMap(c => { const es = evOf(c); return es.length ? es.map(changeFrom) : [c.happenedAt]; }).sort(), tos = picked.flatMap(c => { const es = evOf(c); return es.length ? es.map(changeAt) : [c.happenedAt]; }).sort();
  return {
    id: `against:${week}`, type: "roundup", kicker: "Roundup · Against the grain", headline: `${countWord(domains.length)} brands moved against the grain`,
    deck: `${named.map(d => brandName(d)).join(", ")}${rest ? `; ${countWord(rest).toLowerCase()} more moved against the grain too` : ""}, ${rangeWords(froms[0]!, tos.at(-1)!)}.`,
    facts: picked.flatMap(c => [{ text: c.headline, href: brandPath(c.domains[0]!), basis: c.basis, kind: "member" as const }, ...c.facts.filter(f => f.kind === "stage"),
      ...(backing.get(c.domains[0]!) ?? []).slice(0, 2).map(e => ({ text: `Measured: ${tapeLine(e)}`, href: brandPath(e.domain), basis: "measured" as const, kind: "source" as const }))]),
    sector: null, signalKeys: [...new Set(picked.flatMap(c => c.signalKeys))].slice(0, 6), domains, evidence: named.slice(0, 4).map(d => ({ label: brandName(d), href: brandPath(d) })),
    sourceIds: picked.map(c => `story:${c.id}`), basis: picked.some(c => c.basis === "ai") ? "ai" : "measured", happenedAt: byTime.at(-1)!.happenedAt, magnitude: domains.length, members: picked.map(c => c.id),
  };
}

// PATTERNS -------------------------------------------------------------------------------------------------------------------------
type Move = { c: Candidate; e: EventRow };
const shownTier = (ctx: Ctx, k: string) => { const t = ctx.tiers.get(k); return t === "headline" || t === "supporting"; };
/** Roundups: three or more brands gaining the same signal within seven days (in one sector first, then across sectors). Going the other way is cited. */
export function roundups(ctx: Ctx, moves: Move[], against: Move[] = []): Candidate[] {
  const out: Candidate[] = [], used = new Set<string>();
  const emit = (members: Move[], sector: string | null, key: string) => {
    const domains = [...new Set(members.map(m => m.e.domain))].sort(ctx.byRank); if (domains.length < ROUNDUP_MIN) return;
    for (const m of members) used.add(m.c.id);
    const times = members.map(m => m.e.detected_at).sort(), l = label(key), s = sector ? `${inline(sectorName(sector))} ` : "";
    const from = members.map(m => changeFrom(m.e)).sort()[0]!, to = members.map(m => changeAt(m.e)).sort().at(-1)!;
    const lo = Date.parse(times[0]!), hi = Date.parse(times.at(-1)!);
    const other = against.filter(m => traitDelta(m.e).dropped.includes(key) && Date.parse(m.e.detected_at) >= lo - DAY && Date.parse(m.e.detected_at) <= hi + DAY && (!sector || m.e.sector === sector));
    const sorted = [...members].sort((a, b) => a.e.detected_at.localeCompare(b.e.detected_at));
    out.push({ id: `roundup:${sector ?? "all"}:${key}:${times[0]!.slice(0, 10)}`, type: "roundup", kicker: `Roundup · ${l.dimension}${sector ? ` · ${sectorName(sector)}` : ""}`,
      headline: `${countWord(domains.length)} ${s}brands moved to ${inline(l.name)}`, deck: `${listOf(domains.map(d => brandName(d)), 4)}, ${rangeWords(from, to)}.`,
      facts: [...sorted.map(m => ({ text: tapeLine(m.e), href: brandPath(m.e.domain), basis: m.c.basis, kind: "member" as const })),
        ...(other.length ? [{ text: `Going the other way: ${listOf([...new Set(other.map(m => tapeLine(m.e)))], 3)}`, href: patternPath(key), basis: "measured" as const, kind: "count" as const }] : [])],
      sector, signalKeys: [key], domains, evidence: [{ label: "Signal page", href: signalPath(key) }, { label: "Pattern", href: patternPath(key) }],
      sourceIds: members.map(m => `event:${m.e.id}`), basis: members.some(m => m.c.basis === "ai") || basis(key) === "ai" ? "ai" : "measured",
      happenedAt: times.at(-1)!, magnitude: domains.length, stage: ctx.row(ctx.cur, key)?.stage ?? null });
  };
  const group = (keyOf: (m: Move) => string[]) => {
    const g = new Map<string, Move[]>();
    for (const m of moves) if (!used.has(m.c.id)) for (const k of keyOf(m)) g.set(k, [...(g.get(k) ?? []), m]);
    return [...g].sort(([a], [b]) => a.localeCompare(b));
  };
  for (const [k, ms] of group(m => traitDelta(m.e).gained.filter(t => shownTier(ctx, t)).map(t => `${m.e.sector ?? "all"}|${t}`))) {
    const [sector, key] = k.split("|");
    for (const cl of clusters(ms.filter(m => !used.has(m.c.id)), m => m.e.detected_at, PATTERN_DAYS)) emit(cl, sector === "all" ? null : sector!, key!);
  }
  for (const [key, ms] of group(m => traitDelta(m.e).gained.filter(t => shownTier(ctx, t)))) {
    for (const cl of clusters(ms.filter(m => !used.has(m.c.id)), m => m.e.detected_at, PATTERN_DAYS)) if (new Set(cl.map(m => m.e.sector)).size >= 2) emit(cl, null, key);
  }
  return out;
}
/** Stage changes: under SHIFT_MIN_SHARE they go to the Brief table only; changes in one family of signals from one run pair are one story. */
export function shifts(ctx: Ctx): Candidate[] {
  const all = shiftCandidates(ctx).map(c => { const r = ctx.row(ctx.cur, c.signalKeys[0]!); return (r?.current_share ?? 0) < SHIFT_MIN_SHARE ? { ...c, holdReason: SHIFT_BRIEF_REASON } : c; });
  const out = [...all], fam = new Map<string, Candidate[]>();
  for (const c of all) { const cat = c.signalKeys[0]!.split(":")[0]!; if (!c.holdReason && SHIFT_FAMILIES.has(cat)) fam.set(`${cat}|${c.runId}`, [...(fam.get(`${cat}|${c.runId}`) ?? []), c]); }
  for (const [k, cs] of fam) {
    if (cs.length < 2) continue;
    const [cat, run] = k.split("|"), first = cs[0]!;
    const parts = cs.map(c => c.headline.replace(/ moved from /, ": "));
    out.push({ ...first, id: `shift:${cat}:${run}`, kicker: `Shift · ${label(first.signalKeys[0]!).dimension}`, headline: parts.join("; ").replace(/: (\w+) to /g, ": $1 to "),
      deck: cs.map(c => c.deck ?? "").filter(Boolean).join(" "), facts: cs.flatMap(c => c.facts.filter(f => f.kind !== "brand")), signalKeys: cs.flatMap(c => c.signalKeys), domains: [],
      sourceIds: [...new Set(cs.flatMap(c => c.sourceIds))], magnitude: Math.max(...cs.map(c => c.magnitude)), members: cs.map(c => c.id) });
  }
  return out;
}

// EVERYTHING -----------------------------------------------------------------------------------------------------------------------
export type AllCandidates = { /** W1b · every change considered as a quiet change, with its outcome. */ quiet?: QuietVerdict[]; candidates: Candidate[]; ctx: Ctx; newsDropped: number; newsKept: number; newsDrops: NewsDrops; reversed: number[]; reversedIdentity: string[]; groups: BrandGroup[]; tape: Record<number, string>;
  /** E2e · changes that failed the integrity check (Data view only): event id, its label ("Seen once" / "Alternating") and the conditions. */
  unconfirmed: { id: number; label: string; failed: Condition[] }[] };
/** E2e · the input with only the passing part of each live change (integrity.ts); unchanged when it carries no checks. */
export function confirmedInput(input: BuildInput): { input: BuildInput; unconfirmed: AllCandidates["unconfirmed"] } {
  if (!input.checks) return { input, unconfirmed: [] };
  const { tape, unconfirmed } = splitChecked(input.events, new Map(Object.entries(input.checks).map(([k, v]) => [Number(k), v])));
  return { input: { ...input, events: tape }, unconfirmed: unconfirmed.map(u => ({ id: u.id, label: u.label, failed: u.failed })) };
}
/** Names in every reader-facing text of a candidate (headline, deck, kicker, facts, evidence labels); ids, domains and links stay. */
export const named = (c: Candidate, names?: ReadonlyMap<string, string | null>): Candidate => ({
  ...c, kicker: nameText(c.kicker, names), headline: noDollar(nameText(c.headline, names)), deck: c.deck == null ? null : noDollar(nameText(c.deck, names)),
  facts: c.facts.map(f => ({ ...f, text: noDollar(nameText(f.text, names)) })), evidence: c.evidence.map(e => ({ ...e, label: nameText(e.label, names) })),
});
export function allCandidates(raw: BuildInput): AllCandidates {
  const { input, unconfirmed } = confirmedInput(raw);
  const ctx = context(input), names = new Map(input.sites.map(s => [s.domain, s.name]));
  const kindOf = new Map(input.sites.map(s => [s.domain, siteKind(s.domain, s.kind ?? null)]));
  const kind = (d: string) => kindOf.get(d) ?? siteKind(d);
  const texts = new Map(Object.entries(input.texts ?? {}).map(([k, v]) => [Number(k), v]));
  const seasonal = seasonalEventIds(input.events, texts);
  const reversed = reversalIds([...new Map([...(input.history ?? []), ...input.events].map(e => [e.id, e])).values()]);
  // E2c · the carousel: a headline, hero or imagery change captured on a rotating first screen is a tape line marked Carousel and never
  // makes or joins a story (its other layout fields are judged as before). Calls code makes (carousel, fragment) win over stored calls.
  const carouselSnaps = new Set(input.carousel ?? []), rotating = carouselEventIds(input.events, carouselSnaps);
  const calls: Record<number, { call: string; reason: string }> = { ...(input.calls ?? {}) };
  for (const e of input.events) if (e.type === "message_pivot") { const c = codeCall(headlineOf(e.before), headlineOf(e.after), { carousel: rotating.has(e.id) }); if (c) calls[e.id] = { call: c.call, reason: c.reason }; }
  const tape = Object.fromEntries(input.events.map(e => [e.id, tapeLine(e, { seasonal: seasonal.has(e.id), reversed: reversed.has(e.id), carousel: rotating.has(e.id) }, names.get(e.domain))]));
  const judged = withoutRotations(input.events, rotating);
  // E2d · the studio rule (carousel.ts): on studio homepages palette, accent and hero media follow the featured client work, so for those
  // fields a studio is treated as an editorial homepage is (no single-brand story, no palette or imagery move in a roundup); its own type,
  // headline and layout are judged as before, and roundups that gather studios' layout moves are unaffected.
  const sectorOf = new Map(input.sites.map(s => [s.domain, s.sector ?? null]));
  const showcase = (e: EventRow) => isShowcaseSector(sectorOf.get(e.domain) ?? e.sector);
  const visible = judged.filter(e => isVisibleMove(e) && isHome(e)).sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id);
  // Story-eligible: measured, not seasonal, not reversed. Everything else stays a tape line.
  const eligible = visible.filter(e => !seasonal.has(e.id) && !reversed.has(e.id) && !AI_EVENTS.has(e.type));
  const changes = eligible.map(e => changeOf(e, kind(e.domain), (calls[e.id]?.call as HeadlineCallClass | undefined) ?? null, { showcase: showcase(e) }));
  const groups = brandGroups(changes), brand = groups.filter(g => g.qualifiedAt).map(g => brandStory(ctx, g, calls, names.get(g.domain)));
  // A headline change the call could not settle is held for the desk with the reason (standard sites; never a story on its own).
  const unclear: Candidate[] = eligible.filter(e => e.type === "message_pivot" && kind(e.domain) === "standard" && calls[e.id]?.call === "unclear").map(e => ({
    ...moveCandidate(e), id: `call:${e.id}`, kicker: `Headline call · ${e.sector ? sectorName(e.sector) : "Library"}`, headline: `${brandName(e.domain, names.get(e.domain))}: ${tapeWhat(e)}`,
    holdReason: UNCLEAR_HOLD(calls[e.id]!.reason) }));
  // Counter-moves (held singly) and roundups count measured and AI-read moves alike, never seasonal ones; roundups never count reversed ones.
  // On merchandised and editorial homepages only typeface and layout moves count; a headline copy change counts only when it is a position.
  // On studio homepages palette and imagery moves follow the featured work and do not count (as on editorial homepages).
  const counts = (e: EventRow) => (kind(e.domain) === "standard" ? !(showcase(e) && (e.type === "palette_shift" || e.type === "imagery_shift")) && (e.type !== "message_pivot" || calls[e.id]?.call === "position") : e.type === "type_change" || e.type === "layout_change");
  const asMove = (e: EventRow): Move => { const c = moveCandidate(e); if (AI_EVENTS.has(e.type)) c.holdReason = ESTIMATE_ONLY_REASON; return { c, e }; };
  const free: Move[] = visible.filter(e => !seasonal.has(e.id) && counts(e)).map(asMove);
  // Counter-moves are held singly on every kind of site (a media homepage dropping a rising signal is still against the grain).
  const counters = counterMoveCandidates(ctx, visible.filter(e => !seasonal.has(e.id) && (e.type !== "message_pivot" || calls[e.id]?.call === "position")).map(asMove)).map(c => ({ ...c, holdReason: c.sourceIds.some(x => /^event:(\d+)$/.test(x) && reversed.has(Number(x.slice(6)))) ? REVERSED_REASON : COUNTER_HELD_REASON }));
  const reversedCounters = new Set(counters.filter(c => c.holdReason === REVERSED_REASON).map(c => c.id));
  const grain = againstTheGrain(ctx, counters, reversedCounters, judged.filter(e => (e.source ?? "live") === "live" && !reversed.has(e.id)), new Map(input.events.map(e => [e.id, e])));
  const notReversed = free.filter(m => !reversed.has(m.e.id));
  const pattern = roundups(ctx, notReversed, visible.filter(e => !seasonal.has(e.id) && counts(e)).map(e => ({ c: moveCandidate(e), e })));
  // E2g · the census replaces the change-based seasonal story (seasonalStory is no longer built; the "Seasonal" tape mark stays). Its
  // "newly added" changes come from the confirmed live changes of the last 14 days, rotations left out.
  const checked14 = raw.checks ? splitChecked(raw.history ?? raw.events, new Map(Object.entries(raw.checks).map(([k, v]) => [Number(k), v]))).tape : (input.history ?? input.events);
  const census = censusCandidates({ now: input.now, census: input.census ?? null, events: checked14, rotating: carouselEventIds(checked14, carouselSnaps) },
    new Map(input.sites.map(s => [s.domain, { domain: s.domain, name: s.name, sector: s.sector }])), ctx.rank);
  const matcher = newsMatcher(input.sites, ctx.headline), news = newsCandidates(matcher, input.wire);
  // W1b · quiet changes: confirmed icon/card changes and same-address identity changes on other surfaces that no outlet we read named.
  const quiet = quietCandidates({ now: input.now, events: input.events.filter(e => !reversed.has(e.id)), quiet: input.quiet ?? null, matcher, sites: new Map(input.sites.map(s => [s.domain, { domain: s.domain, name: s.name, sector: s.sector, kind: kind(s.domain) }])) });
  const ws = whiteSpaceCandidates(ctx);
  const candidates = [
    ...brand, ...unclear, ...shifts(ctx), ...breakoutCandidates(ctx, input.alerts), ...firstSeenCandidates(ctx, input.archive), ...crossoverCandidates(ctx),
    ...counters, ...(grain ? [grain] : []), ...ws, ...pattern, ...census, ...quiet.candidates, ...input.launches.map(launchCandidate), ...news.candidates,
  ].map(c => named(c, names));
  return { quiet: quiet.verdicts, candidates, ctx, newsDropped: news.dropped, newsKept: news.candidates.length, newsDrops: news.drops, reversed: [...reversed].sort((a, b) => a - b), reversedIdentity: [], groups, tape, unconfirmed };
}

// PART 3 · ONE BRAND, ONE STORY: fold a later change into the story that already ran ----------------------------------------------
export type ShownStory = { id: string; type: string; state: string; happened_at: string; domains: string[]; headline: string; deck: string | null; facts: unknown; source_ids: string[] };
export type Fold = { story_id: string; candidate: string; payload: { headline: string; deck: string; facts: Fact[] }; note: string; added: string[] };
// E2h · a told change is the same change whatever its date reads ("· 20 Nov" by confirmation, "· between 11 and 14 Nov" by its captures):
// matching on the dated text let a build on older code fold the same changes back in, and its deck won over the dated correction.
const factTexts = (v: unknown) => new Set((Array.isArray(v) ? v : []).map(f => (f && typeof f === "object" ? undated(String((f as Fact).text ?? "")) : "")));
/** The published single-brand story a brand story belongs to: its own id, else the same brand's story from inside the window. */
export function foldTarget(c: Candidate, existing: ShownStory[]): ShownStory | null {
  if (c.domains.length !== 1 || !c.id.startsWith("brand:")) return null;
  const d = c.domains[0]!, start = Date.parse(c.id.split(":").at(-1)!), end = start + GROUP_DAYS * DAY;
  const mine = existing.filter(s => s.state === "published" && s.domains.length === 1 && s.domains[0] === d && ["move", "rebrand", "counter_move"].includes(s.type));
  return mine.find(s => s.id === c.id) ?? mine.filter(s => Date.parse(s.happened_at) >= start - GROUP_DAYS * DAY && Date.parse(s.happened_at) < end).sort((a, b) => a.happened_at.localeCompare(b.happened_at))[0] ?? null;
}
/**
 * Corrections for brand stories whose brand already has a published story in the window: the story that ran gains the new specifics (an
 * appended `correct` edit noting the update), and nothing new is published. Idempotent: no correction when every specific is already told.
 */
export function brandFolds(candidates: Candidate[], existing: ShownStory[], now: string): { folds: Fold[]; told: Map<string, string> } {
  const folds: Fold[] = [], told = new Map<string, string>();
  for (const c of candidates) {
    const t = foldTarget(c, existing); if (!t) continue;
    if (t.id !== c.id) told.set(c.id, t.id);
    const have = factTexts(t.facts), add = c.facts.filter(f => f.kind === "member" && !have.has(undated(f.text)));
    if (!add.length) continue;
    const keep = (Array.isArray(t.facts) ? t.facts : []).filter((f): f is Fact => !!f && typeof f === "object" && typeof (f as Fact).text === "string");
    const facts = [...keep.filter(f => f.kind !== "date" && f.kind !== "share"), ...add, ...c.facts.filter(f => (f.kind === "share" || f.kind === "date" || f.kind === "source") && !have.has(undated(f.text)))];
    folds.push({ story_id: t.id, candidate: c.id, payload: { headline: c.headline, deck: c.deck ?? t.deck ?? "", facts }, added: add.map(f => f.text),
      note: `Updated ${tapeDate(now)}: added ${listOf([...new Set(add.map(f => f.text.split(" · ")[0]!.split(",")[0]!.trim().toLowerCase()))], 4)} (one brand, one story).` });
  }
  return { folds, told };
}
