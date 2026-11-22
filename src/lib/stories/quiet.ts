// W1b · THE QUIET CHANGE — "Who rebranded without telling anyone", told only as far as the record supports it. Pure.
//
// A candidate is a confirmed change to how a brand presents itself that we found no outside mention of:
//   · a new site icon or social card (asset-diff.ts: visibly different, old version seen on two captures, new one on two at least six
//     hours apart), or
//   · a measured identity change (headline typeface, palette or accent, theme) on a non-home surface whose before and after captures
//     are of the same address (a product page compared with a different product page is not a change). Typeface changes count on every
//     surface; an accent or theme change counts only on a standard site's about, pricing or changelog page, because product pages and
//     merchandised, editorial and studio sites take their colours from what they show, and a whole-palette change follows the page's
//     pictures (only the measured accent counts);
// and no wire item names the brand (strict matching, I3: whole names, aliases, domains) from 14 days before the change to 14 days after
// it (or to now, when that is sooner). The story never claims nobody announced it: it says "We found no mention in the N outlets we
// read", N being the distinct publications on the wire's source list (wire-sources.ts: news sites and blogs read by RSS) with an item
// in that window; social accounts and aggregators are searched for a mention but are never counted or named as outlets. With no outlet
// read in the window there is no sentence to say, so no candidate. Studios' colour and theme follow their showcased work and do not count.
// W1c · a page that follows its own homepage is not a quiet change: when the homepage has a confirmed measured change of the same kind
// (typeface, palette or accent, theme) within 30 days either side, the other page's change is the redesign reaching it, and becomes one
// fact on the brand's own move or rebrand story instead ("The changelog page now uses Systemia too"). An icon or card change is judged
// against any confirmed homepage identity change (or a confirmed rebrand) in the same window.
// W1d · what a quiet change needs: a confirmed new site icon, a confirmed new social card, or a confirmed change of the headline or body
// typeface on another page at the same address. An accent, palette or theme change alone on another page never qualifies; it stays a
// line on the tape (it can still become a fact on the brand's own story, W1c). And a picture to lead with: the old and new icon or card,
// or the page's first screen before and after (surface crops). With no picture it does not run.
// Stored as a `move` row (the stored type list is a fixed check), told apart by its `quiet:` id and its "Quiet change" kicker.
import { brandName } from "../brand-names";
import { isShowcaseSector } from "../carousel";
import { betweenDays, dayText, sectorName, shortDay } from "../labels";
import { brandPath } from "../ia";
import type { EventRow } from "../agency/changes";
import { moveCandidate, newsMatches, type NewsMatcher, type WireIn } from "./candidates";
import { isOutletItem } from "../wire-sources";
import { colourName } from "../colour-names";
import type { Candidate, Fact } from "./types";

export const QUIET_WINDOW_DAYS = 14;
export const QUIET_EVENT_TYPES: Record<string, string> = { type_change: "typeface", palette_shift: "accent colour", theme_flip: "theme" };
export const QUIET_PAGES: Record<string, string> = { product: "product page", about: "about page", pricing: "pricing page", changelog: "changelog" };
export const QUIET_KICKER = "Quiet change";
const DAY = 864e5;
export const isQuietId = (id: string) => id.startsWith("quiet:");

export type QuietAsset = { domain: string; kind: "icon" | "card" | string; from: { path: string; last_seen_at: string }; to: { path: string; first_seen_at: string }; between: { old_last: string; new_first: string }; confirmed_at: string | null };
/** W1c · a confirmed measured homepage identity change (live, desktop, passed the integrity check), or a confirmed rebrand (`type: "rebrand"`). */
export type HomeChange = { id: number | null; domain: string; type: "type_change" | "palette_shift" | "theme_flip" | "rebrand" | string; at: string; after?: unknown };
export type QuietInput = { assets: QuietAsset[]; /** Address of each capture the changes cite (snapshot id → url). */ urls: Record<number, string | null>; /** Wire items from 14 days before the window to now. */ wire: WireIn[];
  /** W1c · confirmed homepage identity changes from 30 days before the window to now (absent = none known). */ home?: HomeChange[];
  /** W1d · stored first screens of the brands' other pages (surface crops), for the before-and-after picture (absent = none). */ shots?: PageShot[] };
/** W1d · one stored first screen of another page: `page` is the QUIET_PAGES key (product, about, pricing). */
export type PageShot = { domain: string; page: string; path: string; first_seen_at: string; last_seen_at: string };
/** W1d · the event types that can make a quiet change on another page: a headline or body typeface change. Colour and theme stay on the tape. */
export const QUIET_STORY_TYPES = ["type_change"] as const;
/** W1d · the typeface fields a qualifying change touches (headline or body). */
const TYPEFACE_FIELDS = ["h1", "h1_family", "body", "body_family"];
export const QUIET_NEEDS = {
  what: "a confirmed new site icon, a confirmed new social card, or a confirmed change of headline or body typeface on another page at the same address",
  notAlone: "an accent, palette or theme change alone on another page stays a line on the tape",
  picture: "the old and new icon or card, or the page's first screen before and after; with no picture it does not run",
} as const;
/** W1d · the page's stored first screens either side of a change: the latest first seen at or before the last old capture, and the
 *  earliest first seen after it, when they are different pictures. Null when either is missing. */
export function pagePair(shots: readonly PageShot[] | undefined, domain: string, page: string, before: string | null, after: string): { before: PageShot; after: PageShot } | null {
  const mine = (shots ?? []).filter(x => x.domain === domain && x.page === page).sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
  const cut = before ?? after, old = [...mine].reverse().find(x => x.first_seen_at <= cut), next = mine.find(x => x.first_seen_at > cut && x.first_seen_at <= new Date(Date.parse(after) + 7 * DAY).toISOString());
  return old && next && old.path !== next.path ? { before: old, after: next } : null;
}
export type QuietSite = { domain: string; name: string | null; sector: string | null; /** Site kind (brand-names.ts siteKind): standard, merchandised, editorial. */ kind?: string | null };
export type QuietVerdict = { id: string; domain: string; what: string; when: string; outcome: "candidate" | "mentioned" | "different address" | "colour follows content" | "follows homepage" | "no outlets read" | "tape line" | "no picture"; detail: string | null };
/** W1c · a non-home change that follows the homepage: the fact it adds to the brand's own story, and the homepage changes it follows. */
export type QuietFollow = { domain: string; at: string; home: HomeChange[]; fact: Fact };
export const HOME_FOLLOW_DAYS = 30;
/** Which homepage change types a non-home change of each type follows (same kind); icons and cards follow any identity change. */
const SAME_KIND: Record<string, readonly string[]> = { type_change: ["type_change"], palette_shift: ["palette_shift"], theme_flip: ["theme_flip"] };
const ANY_IDENTITY = ["type_change", "palette_shift", "theme_flip", "rebrand"] as const;
/** The confirmed homepage changes of `domain` of the given types within 30 days either side of `at`. */
export function homeFollowed(home: readonly HomeChange[] | undefined, domain: string, at: string, types: readonly string[]): HomeChange[] {
  const t = Date.parse(at), w = HOME_FOLLOW_DAYS * DAY;
  return (home ?? []).filter(h => h.domain === domain && types.includes(h.type) && Math.abs(Date.parse(h.at) - t) <= w).sort((a, b) => a.at.localeCompare(b.at));
}
const FACT_PAGE: Record<string, string> = { product: "product page", about: "about page", pricing: "pricing page", changelog: "changelog page" };
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? v as Record<string, unknown> : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
/** The new value a change measured, in words: the headline typeface, the accent's colour name, the theme. */
function newValue(type: string, after: unknown): string | null {
  const a = obj(after);
  if (type === "type_change") return str(a["h1"]) ?? str(a["h1_family"]) ?? str(a["body"]) ?? str(a["body_family"]);
  if (type === "palette_shift") { const hex = str(a["accent"]); return hex ? colourName(hex) ?? hex.toUpperCase() : null; }
  if (type === "theme_flip") return str(a["theme"]);
  return null;
}
/** "The changelog page now uses Systemia too, between 13 and 21 Nov" (same new value as the homepage), else what it changed to. */
export function followFact(e: Pick<EventRow, "type" | "after" | "page_type">, home: readonly HomeChange[], when: string): string {
  const page = FACT_PAGE[e.page_type ?? ""] ?? "other page", Page = `The ${page}`, mine = newValue(e.type, e.after);
  const same = mine != null && home.some(h => newValue(h.type, h.after)?.toLowerCase() === mine.toLowerCase());
  const word = e.type === "type_change" ? "typeface" : e.type === "palette_shift" ? "accent colour" : "theme";
  const value = e.type === "theme_flip" && mine ? `the ${mine} theme` : e.type === "palette_shift" && mine ? `the ${mine.toLowerCase()} accent` : mine;
  if (same && value) return `${Page} now uses ${value} too, ${when}`;
  return mine ? `${Page} changed its ${word} too, to ${e.type === "palette_shift" ? mine.toLowerCase() : mine}, ${when}` : `${Page} changed its ${word} too, ${when}`;
}

/** The outside-news check for one change: outlets read in the window, and the first item naming the brand (if any). */
export function mentionCheck(m: NewsMatcher, wire: readonly WireIn[], domain: string, at: string, now: string): { outlets: number; outletNames: string[]; from: string; to: string; mention: WireIn | null } {
  const t = Date.parse(at), from = new Date(t - QUIET_WINDOW_DAYS * DAY).toISOString(), to = new Date(Math.min(Date.parse(now), t + QUIET_WINDOW_DAYS * DAY)).toISOString();
  const inside = wire.filter(w => w.published_at >= from && w.published_at <= to);
  // Every item we read is searched for a mention (a social post naming the brand still counts as a mention); only publications count as outlets.
  const mention = inside.filter(w => newsMatches(m, w.title, w.excerpt).domains.includes(domain)).sort((a, b) => a.published_at.localeCompare(b.published_at))[0] ?? null;
  const outletNames = [...new Set(inside.filter(isOutletItem).map(w => w.source))].sort((a, b) => a.localeCompare(b));
  return { outlets: outletNames.length, outletNames, from, to, mention };
}
const noMention = (n: number, from: string, to: string) => `We found no mention of the brand in the ${n} outlet${n === 1 ? "" : "s"} we read between ${dayText(from)} and ${dayText(to)}`;

function quietCandidate(o: { id: string; domain: string; name: string; sector: string | null; what: string; headline: string; at: string; when: string; facts: Fact[]; check: ReturnType<typeof mentionCheck>; sourceIds: string[]; magnitude: number }): Candidate {
  const brand = brandPath(o.domain), none = noMention(o.check.outlets, o.check.from, o.check.to);
  return {
    id: o.id, type: "move", kicker: `${QUIET_KICKER}${o.sector ? ` · ${sectorName(o.sector)}` : ""}`, headline: o.headline,
    deck: `${o.what[0]!.toUpperCase()}${o.what.slice(1)}, ${o.when}. ${none}.`,
    facts: [...o.facts, { text: `Changed ${o.when}, dated by the last capture before and the first capture after`, href: `${brand}?view=data`, basis: "measured", kind: "date" },
      { text: none, href: "/wire", basis: "measured", kind: "source" }],
    sector: o.sector, signalKeys: [], domains: [o.domain], evidence: [{ label: "Brand page", href: brand }, { label: "Library record", href: `${brand}?view=data` }],
    sourceIds: o.sourceIds, basis: "measured", happenedAt: o.at, magnitude: o.magnitude,
  };
}

/** Every quiet-change candidate from the confirmed changes, with a verdict for each change considered (the desk's and the report's list). */
export function quietCandidates(o: { now: string; events: readonly EventRow[]; quiet: QuietInput | null | undefined; matcher: NewsMatcher; sites: ReadonlyMap<string, QuietSite> }): { candidates: Candidate[]; verdicts: QuietVerdict[]; follows: QuietFollow[] } {
  const out: Candidate[] = [], verdicts: QuietVerdict[] = [], follows: QuietFollow[] = [];
  if (!o.quiet) return { candidates: out, verdicts, follows };
  const homeText = (hs: HomeChange[]) => hs.map(h => `homepage ${h.type === "rebrand" ? "rebrand" : QUIET_EVENT_TYPES[h.type] ?? h.type}${h.id != null ? ` (change ${h.id})` : ""}, ${shortDay(h.at)}`).join("; ");
  const site = (d: string) => o.sites.get(d) ?? null, name = (d: string) => brandName(d, site(d)?.name ?? null);
  for (const a of o.quiet.assets) {
    if (!site(a.domain) || !a.confirmed_at || !a.from.path || !a.to.path) continue;
    const what = a.kind === "icon" ? "a new site icon" : "a new social card", when = betweenDays(a.between.old_last, a.between.new_first), id = `quiet:asset:${a.domain}:${a.kind}:${a.between.new_first.slice(0, 10)}`;
    const followed = homeFollowed(o.quiet.home, a.domain, a.between.new_first, ANY_IDENTITY);
    if (followed.length) {
      verdicts.push({ id, domain: a.domain, what, when, outcome: "follows homepage", detail: homeText(followed) });
      follows.push({ domain: a.domain, at: a.between.new_first, home: followed, fact: { text: `The ${a.kind === "icon" ? "site icon" : "social card"} changed too, ${when}`, href: `${brandPath(a.domain)}?view=data`, basis: "measured", kind: "member" } });
      continue;
    }
    const check = mentionCheck(o.matcher, o.quiet.wire, a.domain, a.between.new_first, o.now);
    if (check.mention) { verdicts.push({ id, domain: a.domain, what, when, outcome: "mentioned", detail: `${check.mention.source}, ${shortDay(check.mention.published_at)}: ${check.mention.title}` }); continue; }
    if (!check.outlets) { verdicts.push({ id, domain: a.domain, what, when, outcome: "no outlets read", detail: null }); continue; }
    verdicts.push({ id, domain: a.domain, what, when, outcome: "candidate", detail: check.outletNames.join(", ") });
    out.push(quietCandidate({ id, domain: a.domain, name: name(a.domain), sector: site(a.domain)?.sector ?? null, what, headline: `${name(a.domain)} has ${what}`, at: a.between.new_first, when, check,
      facts: [{ text: `Before: the ${a.kind === "icon" ? "site icon" : "social card"} last seen ${dayText(a.between.old_last)}`, href: brandPath(a.domain), basis: "measured", kind: "before" },
        { text: `After: a visibly different ${a.kind === "icon" ? "site icon" : "social card"}, first seen ${dayText(a.between.new_first)} and seen again at least six hours later`, href: brandPath(a.domain), basis: "measured", kind: "after" }],
      sourceIds: [`asset-from:${a.from.path}`, `asset-to:${a.to.path}`], magnitude: 3 }));
  }
  for (const e of o.events) {
    const page = QUIET_PAGES[e.page_type ?? ""], field = QUIET_EVENT_TYPES[e.type];
    if (!page || !field || (e.source && e.source !== "live") || (e.viewport && e.viewport !== "desktop") || !site(e.domain)) continue;
    const at = e.seen?.after ?? e.detected_at, when = e.seen ? betweenDays(e.seen.before, e.seen.after) : shortDay(e.detected_at), what = `${e.type === "palette_shift" && !(e.after && typeof e.after === "object" && "accent" in e.after) ? "new colours" : `a new ${field}`} on its ${page}`, id = `quiet:event:${e.id}`;
    const a = e.prev_snapshot_id != null ? o.quiet.urls[e.prev_snapshot_id] : null, b = e.snapshot_id != null ? o.quiet.urls[e.snapshot_id] : null;
    if (!a || !b || a !== b) { verdicts.push({ id, domain: e.domain, what, when, outcome: "different address", detail: `${a ?? "?"} → ${b ?? "?"}` }); continue; }
    const after = (e.after && typeof e.after === "object" ? e.after : {}) as Record<string, unknown>;
    const colourOk = e.page_type !== "product" && (site(e.domain)?.kind ?? "standard") === "standard" && !isShowcaseSector(site(e.domain)?.sector ?? e.sector) && (e.type !== "palette_shift" || ("accent" in after && !("palette" in after)));
    if (e.type !== "type_change" && !colourOk) { verdicts.push({ id, domain: e.domain, what, when, outcome: "colour follows content", detail: null }); continue; }
    const followed = homeFollowed(o.quiet.home, e.domain, at, SAME_KIND[e.type] ?? []);
    if (followed.length) {
      verdicts.push({ id, domain: e.domain, what, when, outcome: "follows homepage", detail: homeText(followed) });
      follows.push({ domain: e.domain, at, home: followed, fact: { text: followFact(e, followed, when), href: b, basis: "measured", kind: "member" } });
      continue;
    }
    // W1d · only a headline or body typeface change can be a quiet change on another page; colour and theme stay on the tape.
    const typeface = (QUIET_STORY_TYPES as readonly string[]).includes(e.type) && TYPEFACE_FIELDS.some(k => k in after);
    if (!typeface) { verdicts.push({ id, domain: e.domain, what, when, outcome: "tape line", detail: QUIET_NEEDS.notAlone }); continue; }
    const pair = pagePair(o.quiet.shots, e.domain, e.page_type ?? "", e.seen?.before ?? null, at);
    if (!pair) { verdicts.push({ id, domain: e.domain, what, when, outcome: "no picture", detail: `no stored first screen of the ${page} either side of the change` }); continue; }
    const check = mentionCheck(o.matcher, o.quiet.wire, e.domain, at, o.now);
    if (check.mention) { verdicts.push({ id, domain: e.domain, what, when, outcome: "mentioned", detail: `${check.mention.source}, ${shortDay(check.mention.published_at)}: ${check.mention.title}` }); continue; }
    if (!check.outlets) { verdicts.push({ id, domain: e.domain, what, when, outcome: "no outlets read", detail: null }); continue; }
    verdicts.push({ id, domain: e.domain, what, when, outcome: "candidate", detail: `${b} · outlets: ${check.outletNames.join(", ")}` });
    const fields = Object.keys(e.after && typeof e.after === "object" ? e.after as object : {}).length;
    out.push(quietCandidate({ id, domain: e.domain, name: name(e.domain), sector: site(e.domain)?.sector ?? e.sector ?? null, what, at, when, check,
      headline: `${name(e.domain)} has ${what}`,
      facts: [{ text: `Page: ${b}, the same address in both captures`, href: b, basis: "measured", kind: "source" }, ...eventFacts(e)],
      sourceIds: [`event:${e.id}`, `page-from:${pair.before.path}`, `page-to:${pair.after.path}`], magnitude: Math.max(1, fields) }));
  }
  return { candidates: out, verdicts, follows };
}
/** W1c · the follow facts added to the brand's own move or rebrand story: the candidate of the same brand that cites one of the homepage
 *  changes followed, else the brand's move or rebrand closest in time within the 30 days; one fact per page change, never repeated. */
export function withFollowFacts<C extends Candidate>(cands: readonly C[], follows: readonly QuietFollow[]): C[] {
  const out = cands.map(c => ({ ...c, facts: [...c.facts] }));
  for (const f of follows) {
    const own = out.filter(c => (c.type === "move" || c.type === "rebrand") && !isQuietId(c.id) && c.domains.length === 1 && c.domains[0] === f.domain);
    const cites = own.find(c => f.home.some(h => h.id != null && c.sourceIds.includes(`event:${h.id}`)));
    const near = own.filter(c => Math.abs(Date.parse(c.happenedAt) - Date.parse(f.at)) <= HOME_FOLLOW_DAYS * DAY).sort((a, b) => Math.abs(Date.parse(a.happenedAt) - Date.parse(f.at)) - Math.abs(Date.parse(b.happenedAt) - Date.parse(f.at)))[0];
    const story = cites ?? near;
    if (!story || story.facts.some(x => x.text === f.fact.text)) continue;
    // Before the closing confirmation line, after the story's own changes.
    const at = story.facts.findIndex(x => x.kind === "date");
    story.facts.splice(at < 0 ? story.facts.length : at, 0, f.fact);
  }
  return out;
}
/** Before and after lines as the move story words them (eventSentence: colour names, typefaces), without its confirmation date. */
const eventFacts = (e: EventRow): Fact[] => moveCandidate(e).facts.filter(f => f.kind !== "date");
