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
// read", N being the distinct outlets with an item in that window. Studios' colour and theme follow their showcased work and do not count.
// Stored as a `move` row (the stored type list is a fixed check), told apart by its `quiet:` id and its "Quiet change" kicker.
import { brandName } from "../brand-names";
import { isShowcaseSector } from "../carousel";
import { betweenDays, dayText, sectorName, shortDay } from "../labels";
import { brandPath } from "../ia";
import type { EventRow } from "../agency/changes";
import { moveCandidate, newsMatches, type NewsMatcher, type WireIn } from "./candidates";
import type { Candidate, Fact } from "./types";

export const QUIET_WINDOW_DAYS = 14;
export const QUIET_EVENT_TYPES: Record<string, string> = { type_change: "typeface", palette_shift: "accent colour", theme_flip: "theme" };
export const QUIET_PAGES: Record<string, string> = { product: "product page", about: "about page", pricing: "pricing page", changelog: "changelog" };
export const QUIET_KICKER = "Quiet change";
const DAY = 864e5;
export const isQuietId = (id: string) => id.startsWith("quiet:");

export type QuietAsset = { domain: string; kind: "icon" | "card" | string; from: { path: string; last_seen_at: string }; to: { path: string; first_seen_at: string }; between: { old_last: string; new_first: string }; confirmed_at: string | null };
export type QuietInput = { assets: QuietAsset[]; /** Address of each capture the changes cite (snapshot id → url). */ urls: Record<number, string | null>; /** Wire items from 14 days before the window to now. */ wire: WireIn[] };
export type QuietSite = { domain: string; name: string | null; sector: string | null; /** Site kind (brand-names.ts siteKind): standard, merchandised, editorial. */ kind?: string | null };
export type QuietVerdict = { id: string; domain: string; what: string; when: string; outcome: "candidate" | "mentioned" | "different address" | "colour follows content"; detail: string | null };

/** The outside-news check for one change: outlets read in the window, and the first item naming the brand (if any). */
export function mentionCheck(m: NewsMatcher, wire: readonly WireIn[], domain: string, at: string, now: string): { outlets: number; from: string; to: string; mention: WireIn | null } {
  const t = Date.parse(at), from = new Date(t - QUIET_WINDOW_DAYS * DAY).toISOString(), to = new Date(Math.min(Date.parse(now), t + QUIET_WINDOW_DAYS * DAY)).toISOString();
  const inside = wire.filter(w => w.published_at >= from && w.published_at <= to);
  const mention = inside.filter(w => newsMatches(m, w.title, w.excerpt).domains.includes(domain)).sort((a, b) => a.published_at.localeCompare(b.published_at))[0] ?? null;
  return { outlets: new Set(inside.map(w => w.source)).size, from, to, mention };
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
export function quietCandidates(o: { now: string; events: readonly EventRow[]; quiet: QuietInput | null | undefined; matcher: NewsMatcher; sites: ReadonlyMap<string, QuietSite> }): { candidates: Candidate[]; verdicts: QuietVerdict[] } {
  const out: Candidate[] = [], verdicts: QuietVerdict[] = [];
  if (!o.quiet) return { candidates: out, verdicts };
  const site = (d: string) => o.sites.get(d) ?? null, name = (d: string) => brandName(d, site(d)?.name ?? null);
  for (const a of o.quiet.assets) {
    if (!site(a.domain) || !a.confirmed_at) continue;
    const what = a.kind === "icon" ? "a new site icon" : "a new social card", when = betweenDays(a.between.old_last, a.between.new_first), id = `quiet:asset:${a.domain}:${a.kind}:${a.between.new_first.slice(0, 10)}`;
    const check = mentionCheck(o.matcher, o.quiet.wire, a.domain, a.between.new_first, o.now);
    if (check.mention) { verdicts.push({ id, domain: a.domain, what, when, outcome: "mentioned", detail: `${check.mention.source}, ${shortDay(check.mention.published_at)}: ${check.mention.title}` }); continue; }
    verdicts.push({ id, domain: a.domain, what, when, outcome: "candidate", detail: null });
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
    const check = mentionCheck(o.matcher, o.quiet.wire, e.domain, at, o.now);
    if (check.mention) { verdicts.push({ id, domain: e.domain, what, when, outcome: "mentioned", detail: `${check.mention.source}, ${shortDay(check.mention.published_at)}: ${check.mention.title}` }); continue; }
    verdicts.push({ id, domain: e.domain, what, when, outcome: "candidate", detail: b });
    const fields = Object.keys(e.after && typeof e.after === "object" ? e.after as object : {}).length;
    out.push(quietCandidate({ id, domain: e.domain, name: name(e.domain), sector: site(e.domain)?.sector ?? e.sector ?? null, what, at, when, check,
      headline: `${name(e.domain)} has ${what}`,
      facts: [{ text: `Page: ${b}, the same address in both captures`, href: b, basis: "measured", kind: "source" }, ...eventFacts(e)],
      sourceIds: [`event:${e.id}`], magnitude: Math.max(1, fields) }));
  }
  return { candidates: out, verdicts };
}
/** Before and after lines as the move story words them (eventSentence: colour names, typefaces), without its confirmation date. */
const eventFacts = (e: EventRow): Fact[] => moveCandidate(e).facts.filter(f => f.kind !== "date");
