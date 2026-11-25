// STORY — one thin shared model for everything that happened (ranking and written copy arrive next phase). Pure.
// Adapters turn what already exists (TODAY lines, stage changes, wire alerts, library events, rebrands, wire news, launches) into Stories with stable ids.
import { alertDisplayTitle, basis, canonical, label, sectorName, stageName, untick, type Basis } from "./labels";
import { EVENT_KIND, rebrandSentence, type EventRow, type RebrandRow } from "./agency/changes";
import { identityLabel, isRebrand } from "./rebrand-rule";
import { tapeLine, type TapeLabels } from "./tape";
import { brandPath, signalPath, terminalHref } from "./ia";
import { soWhat } from "./digest/copy";
import { sectorFirst } from "./sector-lens";
import type { TodayLine } from "./today";
import type { StoryKind } from "./stories/types";

export const STORY_TYPES = ["move", "rebrand", "shift", "breakout", "alert", "launch", "news"] as const;
export type StoryType = (typeof STORY_TYPES)[number] | StoryKind;
export type Story = {
  id: string; type: StoryType; kicker: string; headline: string; deck?: string; at: string; sector?: string | null;
  signalKeys: string[]; domains: string[];
  /** Receipts: an in-app path or an external source URL. */
  evidence: string; basis: Basis | null;
  /** Stored stories (Phase 14): newsworthiness score, correction date and, on the desk/terminal, why it was held. */
  score?: number; corrected?: string | null; held?: string | null;
  /** Permanent public number ("No. 47"), only while published. */
  number?: number | null;
};
export const STORIES_PER_PAGE = 30;
const SITE = /^https?:\/\/[^/]+/;
const AI_EVENTS = new Set(["imagery_shift", "aesthetic_shift"]);
const clip = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A stage change between the two latest runs (library-wide). */
export function fromStageChange(c: { trait: string; from: string | null; to: string | null; share: number | null }, runId: number, at: string): Story {
  const key = canonical(c.trait), l = label(key), to = stageName(c.to), from = stageName(c.from);
  return { id: `shift:${key}:${runId}`, type: "shift", kicker: `${l.dimension} · ${to ?? "Not staged"}`, headline: `${l.name} moved from ${from ?? "unstaged"} to ${to ?? "unstaged"}`,
    deck: soWhat(key, c.to) + (c.share != null ? ` ${Math.round(c.share * 1000) / 10}% of tracked homepages.` : ""), at, sector: null, signalKeys: [key], domains: [], evidence: signalPath(key), basis: basis(key) };
}
const ALERT_VERB: Record<string, string> = { breakout: "is breaking out", saturation: "is nearing saturation", crossover: "flipped its curation lead", sentiment_turn: "is turning tired in design talk", discourse_spike: "spiked in design talk" };
/** A forecast alert from the wire (breakouts → breakout, the rest → alert). The stored title becomes the deck; the headline is a plain sentence. */
export function fromAlert(a: { title: string; url: string; published_at: string; ref?: string | null }): Story {
  const key = a.ref ? canonical(a.ref) : null, path = a.url.replace(SITE, "");
  const sector = /[?&]sector=([a-z-]+)/.exec(path)?.[1] ?? null, kind = /[?&]alert=\d+-([a-z_]+)/.exec(path)?.[1] ?? (/^breakout\b/i.test(a.title.trim()) ? "breakout" : "alert");
  const breakout = kind === "breakout", where = sector && sector !== "all" ? ` in ${sectorName(sector)}` : " across all sectors";
  const display = alertDisplayTitle(a.title, a.ref);
  return { id: `alert:${path}`, type: breakout ? "breakout" : "alert", kicker: `${breakout ? "Breakout" : "Alert"}${key ? ` · ${label(key).dimension}` : ""}${sector && sector !== "all" ? ` · ${sectorName(sector)}` : ""}`,
    headline: key ? `${label(key).name} ${ALERT_VERB[kind] ?? "triggered an alert"}${where}` : display, ...(key ? { deck: display } : {}),
    at: a.published_at, sector: sector === "all" ? null : sector, signalKeys: key ? [key] : [], domains: [], evidence: key ? signalPath(key) : path || terminalHref("wire"), basis: key ? basis(key) : null };
}
/** A confirmed library change on one brand: a line in the latest changes (E2a), linking to the brand, never to a story page. */
export function fromEvent(e: EventRow, l: TapeLabels = {}): Story {
  return { id: `event:${e.id}`, type: "move", kicker: `${EVENT_KIND[e.type] ?? "Change"}${e.sector ? ` · ${sectorName(e.sector)}` : ""}`, headline: tapeLine(e, l), at: e.detected_at, sector: e.sector ?? null,
    signalKeys: [], domains: [e.domain], evidence: brandPath(e.domain), basis: AI_EVENTS.has(e.type) ? "ai" : "measured" };
}
/** A confirmed rebrand. */
export function fromRebrand(r: RebrandRow): Story {
  return { id: `rebrand:${r.domain}:${r.confirmed_at}`, type: isRebrand(r) ? "rebrand" : "move", kicker: `${identityLabel(r)} · ${sectorName(r.sector)}`, headline: rebrandSentence(r), deck: clip(untick(r.read)), at: r.confirmed_at, sector: r.sector,
    signalKeys: [], domains: [r.domain], evidence: brandPath(r.domain), basis: "measured" };
}
/** A design news item from the wire (RSS, Hacker News, Bluesky). */
export function fromWire(w: { id: number; title: string; url: string; source: string; published_at: string; excerpt?: string | null }): Story {
  return { id: `wire:${w.id}`, type: "news", kicker: `News · ${w.source}`, headline: untick(w.title), ...(w.excerpt ? { deck: clip(untick(w.excerpt), 180) } : {}), at: w.published_at, sector: null, signalKeys: [], domains: [], evidence: w.url, basis: null };
}
/** A Product Hunt launch (wire source_kind producthunt). */
export function fromLaunch(w: { id: number; title: string; url: string; published_at: string; excerpt?: string | null }): Story {
  return { id: `launch:${w.id}`, type: "launch", kicker: "Launch · Product Hunt", headline: untick(w.title), ...(w.excerpt ? { deck: clip(untick(w.excerpt), 180) } : {}), at: w.published_at, sector: null, signalKeys: [], domains: [], evidence: w.url, basis: null };
}
/** A TODAY line (terminal Live · Today) as a Story. */
export function fromToday(l: TodayLine): Story {
  const [kind, ...rest] = l.id.split(":"), ref = rest.join(":");
  const type: StoryType = kind === "stage" ? "shift" : kind === "alert" ? (/^New alert: BREAKOUT/i.test(l.text) ? "breakout" : "alert") : kind === "site" ? "move" : "news";
  const kicker = kind === "stage" ? `${l.dimension ?? "Signal"} · Stage change` : kind === "alert" ? "Alert" : kind === "site" ? "Brand change" : kind === "crawl" ? "Crawl" : kind === "type" ? "Google Fonts" : "Wire";
  return { id: `today:${l.id}`, type, kicker, headline: untick(l.text), at: l.at, sector: null, signalKeys: kind === "stage" && ref ? [canonical(ref)] : [], domains: kind === "site" && ref ? [ref] : [], evidence: l.href, basis: l.basis ?? null };
}

export type StreamOptions = { headline?: Set<string> | null; sector?: string; page?: number; perPage?: number };
export type Stream = { lead: Story | null; stories: Story[]; total: number; page: number; pages: number };
/** Newest first, de-duplicated by id; stories about signals must name at least one headline signal; the chosen sector's stories rank first. */
export function storyStream(all: readonly Story[], o: StreamOptions = {}): Stream {
  const seen = new Set<string>(), head = o.headline && o.headline.size ? o.headline : null;
  const kept = all.filter(s => !seen.has(s.id) && (seen.add(s.id), true)).filter(s => !s.signalKeys.length || !head || s.signalKeys.some(k => head.has(k)));
  kept.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
  const ordered = sectorFirst(kept, o.sector ?? "all", s => s.sector);
  const lead = ordered.find(s => s.type === "breakout" || s.type === "shift" || s.type === "rebrand") ?? ordered[0] ?? null;
  const rest = ordered.filter(s => s !== lead), per = o.perPage ?? STORIES_PER_PAGE, pages = Math.max(1, Math.ceil(rest.length / per));
  const page = Math.min(Math.max(0, Math.floor(o.page ?? 0)), pages - 1);
  return { lead, stories: rest.slice(page * per, page * per + per), total: rest.length, page, pages };
}
/** Short time stamp for cards: "15 Nov, 18:20 UTC". */
export const storyTime = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`; };
