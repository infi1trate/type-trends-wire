// Watch page + per-watchlist RSS: one pure item builder over stored rows, so the page, the feed and MCP agree.
import { SITE_URL } from "../site";
import { alertDisplayTitle, explainerPath, label, scopeText, stageName, type Dimension, type StageName } from "../labels";
import { xmlEscape } from "../digest/rss";
import { pickThumb, type Thumb, type ThumbRow } from "../thumbs";
import { eventDetail, eventSentence, rebrandSentence, type EventRow, type RebrandRow } from "./changes";
import { feedPath, viewPath, type WatchPublic } from "./watch";
import { BRAND_NAME } from "../brand";

export const FEED_DAYS = 30;
export const FEED_MAX = 50;
export const WEEK_DAYS = 7;
const DAY = 864e5;

export type StageRow = { run_id: number; dimension: string; value: string; scope: string; stage: string | null; current_share: number | null };
export type RunRow = { id: number; computed_at: string; week: string | null };
export type AlertRow = { id: number; title: string; ref: string | null; url: string; published_at: string };
export type SiteInfo = { domain: string; sector: string; name: string | null; last_change_at: string | null };
export type TraitNow = { dimension: string; value: string; stage: string | null; current_share: number | null };
export type WatchRows = {
  watch: WatchPublic; now: string;
  events: EventRow[]; rebrands: RebrandRow[];
  /** ok forecast runs, ascending, including the one just before the window. */
  runs: RunRow[]; stages: StageRow[]; alerts: AlertRow[];
  /** Traits each watched site shows on its latest live capture. */
  siteTraits: Record<string, string[]>;
  sites: SiteInfo[]; thumbs: ThumbRow[]; traitsNow: TraitNow[];
  lastEvent: EventRow | null;
};
export type WatchItem = { guid: string; kind: "site" | "rebrand" | "stage" | "alert" | "summary"; at: string; title: string; detail: string | null; href: string; domain?: string; trait?: string };

const pctText = (v: number | null) => (v == null ? "" : ` (${Math.round(v * 1000) / 10}% of sites)`);
const KIND_ORDER: Record<WatchItem["kind"], number> = { summary: 0, rebrand: 1, site: 2, stage: 3, alert: 4 };

/** Every change for the watchlist detected after `sinceIso`, newest first, plus weekly summaries (one per weekly forecast run with changes). */
export function watchItems(r: WatchRows, sinceIso: string): WatchItem[] {
  const w = r.watch, sites = new Set([...w.sites, ...w.pending_sites]);
  const items: WatchItem[] = [];
  for (const e of r.events) if (sites.has(e.domain) && e.detected_at > sinceIso)
    items.push({ guid: `event-${e.id}`, kind: "site", at: e.detected_at, title: eventSentence(e), detail: eventDetail(e), href: `/library/${e.domain}`, domain: e.domain });
  for (const b of r.rebrands) if (sites.has(b.domain) && b.confirmed_at > sinceIso)
    items.push({ guid: `rebrand-${b.domain}-${b.confirmed_at}`, kind: "rebrand", at: b.confirmed_at, title: rebrandSentence(b), detail: b.read, href: "/terminal?panel=rebrands", domain: b.domain });

  // Traits: those named on the list plus those its sites show. Sites' traits are read across all sectors; named traits also in the list's sectors.
  const shownBy = new Map<string, string[]>();
  for (const d of w.sites) for (const t of r.siteTraits[d] ?? []) shownBy.set(t, [...(shownBy.get(t) ?? []), d]);
  const named = new Set(w.traits), scopes = ["all", ...w.sectors];
  const stageAt = new Map(r.stages.map(s => [`${s.run_id}|${s.scope}|${s.dimension}:${s.value}`, s]));
  const runs = [...r.runs].sort((a, b) => a.computed_at.localeCompare(b.computed_at));
  for (let i = 1; i < runs.length; i++) {
    const prev = runs[i - 1]!, cur = runs[i]!;
    if (cur.computed_at <= sinceIso) continue;
    for (const s of r.stages) {
      if (s.run_id !== cur.id) continue;
      const key = `${s.dimension}:${s.value}`;
      if (!named.has(key) && !(s.scope === "all" && shownBy.has(key))) continue;
      if (!scopes.includes(s.scope)) continue;
      const to = stageName(s.stage), from = stageName(stageAt.get(`${prev.id}|${s.scope}|${key}`)?.stage);
      if (!to || !from || to === from) continue;
      const l = label(key), by = shownBy.get(key);
      items.push({ guid: `stage-${cur.id}-${s.scope}-${key}`, kind: "stage", at: cur.computed_at, title: `${l.name} [${l.dimension}] moved from ${from} to ${to} in ${scopeText(s.scope)}${pctText(s.current_share)}`,
        detail: named.has(key) ? "A signal on this watchlist" : `Shown by ${by!.slice(0, 4).join(", ")}${by!.length > 4 ? ` and ${by!.length - 4} more` : ""}`, href: `/terminal?panel=brief&trait=${encodeURIComponent(key)}&sector=${s.scope}`, trait: key });
    }
  }
  for (const a of r.alerts) if (a.ref && (named.has(a.ref) || shownBy.has(a.ref)) && a.published_at > sinceIso)
    items.push({ guid: `alert-${a.id}`, kind: "alert", at: a.published_at, title: `Alert: ${alertDisplayTitle(a.title, a.ref)}`, detail: named.has(a.ref) ? "A signal on this watchlist" : `Shown by ${shownBy.get(a.ref)!.slice(0, 4).join(", ")}`, href: a.url.replace(/^https?:\/\/[^/]+/, "") || "/terminal?panel=wire", trait: a.ref });

  // Weekly summary after each weekly (brief) forecast run, when anything changed in the 7 days before it.
  for (const run of runs) {
    if (!run.week || run.computed_at <= sinceIso) continue;
    const from = new Date(Date.parse(run.computed_at) - WEEK_DAYS * DAY).toISOString();
    const inWeek = items.filter(x => x.at > from && x.at <= run.computed_at);
    const siteN = inWeek.filter(x => x.kind === "site" || x.kind === "rebrand").length, stageN = inWeek.filter(x => x.kind === "stage").length;
    if (!siteN && !stageN) continue;
    const parts = [siteN ? `${siteN} site ${siteN === 1 ? "change" : "changes"}` : "", stageN ? `${stageN} trait stage ${stageN === 1 ? "change" : "changes"}` : ""].filter(Boolean);
    items.push({ guid: `summary-${run.week}`, kind: "summary", at: run.computed_at, title: `This week on ${w.name}: ${parts.join(", ")}`, detail: `Week ${run.week}, after the weekly forecast run.`, href: `${viewPath(w.id)}?range=week` });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.guid.localeCompare(b.guid));
}

export type WatchRange = "week" | "30d";
export const rangeDays = (r: WatchRange) => (r === "week" ? WEEK_DAYS : FEED_DAYS);
export const sinceFor = (now: string, r: WatchRange) => new Date(Date.parse(now) - rangeDays(r) * DAY).toISOString();

export type WatchView = {
  id: string; name: string; range: WatchRange; created_at: string; updated_at: string;
  sites: { domain: string; sector: string; name: string | null; lastChange: string | null; thumb: Thumb | null }[];
  pending: string[];
  traits: { trait: string; name: string; dimension: Dimension; stage: StageName | null; share: number | null; explainer: string }[];
  sectors: string[];
  items: WatchItem[];
  empty: string | null;
  feedUrl: string;
};
export function watchView(r: WatchRows, range: WatchRange): WatchView {
  const w = r.watch, info = new Map(r.sites.map(s => [s.domain, s])), now = new Map(r.traitsNow.map(t => [`${t.dimension}:${t.value}`, t]));
  const items = watchItems(r, sinceFor(r.now, range)).filter(i => i.kind !== "summary").slice(0, FEED_MAX);
  const n = w.sites.length + w.pending_sites.length;
  const last = r.lastEvent ? `${eventSentence(r.lastEvent)}, ${r.lastEvent.detected_at.slice(0, 10)}` : null;
  const empty = items.length ? null : !n && !w.traits.length ? "This watchlist is empty. Add sites or signals with its edit link."
    : `Nothing changed on ${n ? `${n === 1 ? "this site" : `these ${n} sites`}` : "these signals"}${n && w.traits.length ? " or signals" : ""} ${range === "week" ? "this week" : "in the last 30 days"}.${last ? ` Last change: ${last}.` : n ? " No change has been recorded for these sites yet." : ""}`;
  return {
    id: w.id, name: w.name, range, created_at: w.created_at, updated_at: w.updated_at,
    sites: w.sites.map(d => { const s = info.get(d); return { domain: d, sector: s?.sector ?? "untracked", name: s?.name ?? null, lastChange: s?.last_change_at ?? null, thumb: pickThumb(r.thumbs, d) }; }),
    pending: w.pending_sites,
    traits: w.traits.map(k => { const l = label(k), t = now.get(k); return { trait: k, name: l.name, dimension: l.dimension, stage: stageName(t?.stage), share: t?.current_share ?? null, explainer: explainerPath(k) }; }),
    sectors: w.sectors, items, empty, feedUrl: `${SITE_URL}${feedPath(w.feed_token)}`,
  };
}

/** RSS 2.0 + atom:link self; ≤50 items from the last 30 days; links point at the (password-gated) watch page anchors. */
export function watchFeedXml(r: WatchRows): string {
  const w = r.watch, self = `${SITE_URL}${feedPath(w.feed_token)}`, page = `${SITE_URL}${viewPath(w.id)}`;
  const items = watchItems(r, sinceFor(r.now, "30d")).slice(0, FEED_MAX);
  const body = items.map(i => `<item><title>${xmlEscape(i.title)}</title><link>${page}#c-${xmlEscape(i.guid)}</link><guid isPermaLink="false">${xmlEscape(`${w.id}:${i.guid}`)}</guid><pubDate>${new Date(i.at).toUTCString()}</pubDate>${i.detail ? `<description>${xmlEscape(i.detail)}</description>` : ""}</item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${xmlEscape(`${w.name} · ${BRAND_NAME} watchlist`)}</title><link>${page}</link><description>${xmlEscape(`Changes on the sites and signals in “${w.name}” over the last ${FEED_DAYS} days.`)}</description><language>en</language><lastBuildDate>${new Date(items[0]?.at ?? r.now).toUTCString()}</lastBuildDate><atom:link href="${self}" rel="self" type="application/rss+xml"/>${body}</channel></rss>`;
}
export const WATCH_FEED_HEADERS = { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900", "X-Robots-Tag": "noindex" };
