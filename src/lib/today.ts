/**
 * TODAY: 3–5 plain-English lines about what moved, built deterministically from public data (no AI per view). Pure.
 * Every line links to the panel, trait or site that proves it.
 */
import { alertDisplayTitle, basis, canonical, label, stageName, type Basis, type Dimension, type StageName } from "./labels";

export type StageRow = { dimension: string; value: string; stage: string | null; momentum: number | null; current_share: number | null };
export type WireLite = { title: string; url: string; source: string; published_at: string; ref?: string | null };
export type TodayInput = {
  now: string;
  runs: { latest: { id: number; computed_at: string } | null; previous: { id: number; computed_at: string } | null };
  stages: { latest: StageRow[]; previous: StageRow[] };
  alerts: WireLite[];
  wire: { count24h: number; latest: WireLite | null };
  event: { domain: string; summary: string; detected_at: string; sector: string | null } | null;
  crawl: { finished_at: string; sites: number } | null;
  type?: { family: string; delta7: number; snapshot: string } | null;
  /** Headline signal keys (tiers.ts). When given, stage and alert lines are limited to headline signals and the Google Fonts (supply-side) line is left out. */
  headline?: Set<string> | null;
};
export type TodayLine = { id: string; text: string; href: string; at: string; fresh: boolean; dimension?: Dimension; basis?: Basis; target?: "trait" | "site" };
export type Today = { date: string; asOf: string | null; lines: TodayLine[]; changed: number; note: string | null };

const DAY = 86_400_000, MAX = 5, MIN = 3; // always up to five lines: fresh changes first, then the freshest older data
const day = (iso: string) => iso.slice(0, 10);
const UP: StageName[] = ["Rising", "Peaking", "Emerging", "Fading", "Steady"];
const SITE = /^https?:\/\/[^/]+/;
const pct = (v: number | null) => (v == null ? "" : `${Math.round(v * 1000) / 10}%`);

export function stageChanges(latest: StageRow[], previous: StageRow[]) {
  const before = new Map(previous.map(r => [`${r.dimension}:${r.value}`, stageName(r.stage)]));
  return latest.flatMap(r => {
    const trait = `${r.dimension}:${r.value}`, to = stageName(r.stage), from = before.get(trait);
    return to && from && to !== from ? [{ trait, from, to, momentum: r.momentum ?? 0, share: r.current_share }] : [];
  }).sort((a, b) => UP.indexOf(a.to) - UP.indexOf(b.to) || Math.abs(b.momentum) - Math.abs(a.momentum) || a.trait.localeCompare(b.trait));
}

export function buildToday(i: TodayInput): Today {
  const now = Date.parse(i.now), fresh = (at: string) => now - Date.parse(at) <= DAY;
  const c: (TodayLine & { p: number })[] = [];
  const add = (p: number, l: Omit<TodayLine, "fresh">) => c.push({ ...l, fresh: fresh(l.at), p });
  const head = i.headline ?? null, isHead = (k: string | null | undefined) => !head || (!!k && head.has(canonical(k)));
  if (i.runs.latest && i.runs.previous) for (const s of stageChanges(i.stages.latest, i.stages.previous).filter(s => isHead(s.trait)).slice(0, 2)) {
    const l = label(s.trait);
    add(0, { id: `stage:${s.trait}`, text: `${l.name} moved from ${s.from} to ${s.to} across all sectors${s.share != null ? ` (${pct(s.share)} of sites)` : ""}`, href: `/terminal?panel=brief&trait=${encodeURIComponent(s.trait)}`, at: i.runs.latest.computed_at, dimension: l.dimension, basis: basis(s.trait), target: "trait" });
  }
  const alerts = i.alerts.filter(a => !head || !a.ref || isHead(a.ref)), a = alerts[0];
  if (a) add(1, { id: `alert:${a.url}`, text: `New alert: ${alertDisplayTitle(a.title, a.ref)}${alerts.length > 1 ? ` (1 of ${alerts.length} from the ${day(a.published_at)} forecast)` : ""}`, href: a.url.replace(SITE, "") || "/terminal?panel=wire", at: a.published_at, ...(a.ref ? { target: "trait" as const, basis: basis(a.ref) } : {}) });
  if (i.event) add(2, { id: `site:${i.event.domain}`, text: `${i.event.domain} changed: ${i.event.summary}${i.event.sector ? ` (${i.event.sector.replace(/-/g, " ")})` : ""}`, href: `/library/${encodeURIComponent(i.event.domain)}`, at: i.event.detected_at, target: "site" });
  if (!head && i.type && i.type.delta7 > 0) add(3, { id: `type:${i.type.family}`, text: `${i.type.family} climbed ${i.type.delta7} places on Google Fonts this week, the biggest climb in the ${i.type.snapshot} snapshot`, href: "/terminal?panel=type", at: `${i.type.snapshot}T23:59:59Z`, dimension: "FONT" });
  if (i.wire.latest) add(4, { id: "wire", text: i.wire.count24h > 0 ? `${i.wire.count24h} new design ${i.wire.count24h === 1 ? "story" : "stories"} in the last 24 hours; the latest is “${i.wire.latest.title}” from ${i.wire.latest.source}` : `Latest design story: “${i.wire.latest.title}” from ${i.wire.latest.source}`, href: "/terminal?panel=wire", at: i.wire.latest.published_at });
  if (i.crawl) {
    const age = Math.floor((now - Date.parse(i.crawl.finished_at)) / DAY);
    add(5, { id: "crawl", text: `The weekly crawl measured ${i.crawl.sites.toLocaleString("en-US")} sites, finished ${day(i.crawl.finished_at)}${age > 7 ? ` (${age} days ago; the next crawl runs Sunday)` : ""}`, href: "/terminal?panel=layout", at: i.crawl.finished_at });
  }
  const changed = c.filter(l => l.fresh).length;
  const lines = [...c].sort((x, y) => Number(y.fresh) - Number(x.fresh) || (x.fresh ? x.p - y.p : Date.parse(y.at) - Date.parse(x.at) || x.p - y.p))
    .slice(0, MAX).map(({ p: _p, ...l }) => l);
  const asOf = c.length ? c.map(l => l.at).filter(at => Date.parse(at) <= now).sort().at(-1) ?? null : null;
  const note = changed >= MIN ? null
    : c.length === 0 ? "No data has arrived yet. The first lines appear after the daily font snapshot and the 15-minute news check."
    : changed === 0 ? "Nothing new in the last 24 hours, so here is the freshest data we have."
    : `Only ${changed} ${changed === 1 ? "thing" : "things"} changed in the last 24 hours, so the freshest data fills the rest.`;
  return { date: day(i.now), asOf, lines, changed, note };
}
