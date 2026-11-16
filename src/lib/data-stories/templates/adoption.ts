// ADOPTION TIMELINE: a signal's adopters ordered by the first well-covered capture where each showed it. Pure.
// A first sighting is "established" only when the brand has an earlier well-covered capture without it; a brand that already shows
// it in its first well-covered capture is left-censored ("already there"), so its entry date cannot be known.
import type { Adopter, AdoptionFig, Point } from "../types";
import { byQuarter, knows, traitsOf, type HistRow, type SharePoint, type SiteInfo } from "../series";
import { brandHref, signalHref } from "../text";

export type AdoptionIn = { signal: { key: string; name: string }; sites: SiteInfo[]; rows: HistRow[]; usable: string[]; share: SharePoint[]; title: string; note: string };
export type Adoption = { fig: AdoptionFig; entries: Adopter[]; censored: Adopter[]; dropped: Adopter[]; never: string[]; unknown: number };
export function adoption(i: AdoptionIn): Adoption {
  const usable = new Set(i.usable), by = new Map<string, HistRow[]>();
  for (const r of i.rows) if (usable.has(r.quarter) && knows(i.signal.key, r)) by.set(r.domain, [...(by.get(r.domain) ?? []), r]);
  const adopters: Adopter[] = [], never: string[] = [];
  let unknown = 0;
  for (const s of i.sites) {
    const rows = (by.get(s.domain) ?? []).sort((a, b) => byQuarter(a.quarter, b.quarter));
    if (!rows.length) { unknown++; continue; }
    const k = rows.findIndex(r => traitsOf(r).has(i.signal.key));
    if (k < 0) { never.push(s.domain); continue; }
    const first = rows[k]!, last = rows[rows.length - 1]!;
    adopters.push({ domain: s.domain, name: s.name ?? s.domain, sector: s.sector, first: first.quarter, firstAt: first.captured_at ?? "", censored: k === 0, dropped: !traitsOf(last).has(i.signal.key), href: brandHref(s.domain) });
  }
  adopters.sort((a, b) => byQuarter(a.first, b.first) || a.firstAt.localeCompare(b.firstAt) || a.domain.localeCompare(b.domain));
  const share: Point[] = i.share.map(p => ({ x: p.q, y: p.share }));
  const fig: AdoptionFig = { kind: "adoption", title: i.title, note: i.note, signal: { ...i.signal, href: signalHref(i.signal.key) }, quarters: [...i.usable].sort(byQuarter), share, adopters, never: never.length, total: i.sites.length };
  return { fig, entries: adopters.filter(a => !a.censored), censored: adopters.filter(a => a.censored), dropped: adopters.filter(a => a.dropped), never: never.sort(), unknown };
}
/** The first well-covered quarter whose share is at least double the first one's (null when it never doubled or started at zero). */
export function doubledAt(share: SharePoint[]): SharePoint | null {
  const base = share[0];
  if (!base || base.share <= 0) return null;
  return share.slice(1).find(p => p.share >= 2 * base.share) ?? null;
}
