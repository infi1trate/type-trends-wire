// F9 Rebrand Desk: pure identity-change detection over confirmed (two-capture) library events. No I/O.
import { colorTicker } from "./taste/color";
import { siteTraits } from "./forecast-signals";

export const REBRAND_SINCE = "2021-01-01T00:00:00Z";
export const REDESIGN_MIN_FIELDS = 3;
export const WIRE_MATCH_DAYS = 14;
export const MAX_REBRAND_LIMIT = 25;
export const REBRAND_REASONS = ["font", "accent", "palette", "theme", "redesign"] as const;
export type RebrandReason = (typeof REBRAND_REASONS)[number];
/** Event types that may carry identity fields; text-bearing types (message/pricing/surface) are never read. */
export const MEASURED_EVENT_TYPES = ["type_change", "palette_shift", "theme_flip", "redesign", "layout_change", "stack_change", "nav_change"] as const;
const AI_KEYS = new Set(["aesthetic", "tone", "imagery", "components", "hero_layout", "color_mood", "ai_positioning"]);

export type EventIn = { id: number; domain: string; source: string; type: string; before: unknown; after: unknown; effective_at: string; detected_at: string; snapshot_id: number | null; prev_snapshot_id: number | null };
export type SideIn = { id: number; captured_at: string | null; h1: string | null; body: string | null; theme: string | null; bg: string | null; accent: string | null; palette: string[]; hero_media: string | null; archive_url: string | null; tags: { hero_layout: string | null; aesthetic: string[]; tone: string[] } | null };
export type Side = Omit<SideIn, "id"> & { snapshot_id: number | null; h1_google: boolean; body_google: boolean };
export type ForecastIn = { dimension: string; value: string; scope: string; stage: string | null; status: string; current_share: number | null; momentum: number | null };
export type WireIn = { id: number; title: string | null; excerpt: string | null; url: string; source: string | null; source_kind: string | null; published_at: string };
export type TraitStage = { trait: string; label: string; scope: string; stage: string | null; share: number | null; momentum: number | null };
export type Rebrand = {
  id: string; domain: string; sector: string; name: string | null; source: "live" | "archive"; confirmed_at: string; effective_at: string; detected_at: string;
  reasons: RebrandReason[]; fields: string[]; event_ids: number[]; before: Side; after: Side; read: string; new_traits: TraitStage[];
  links: { library: string; archive: string | null; archive_before: string | null }; wire: { title: string; url: string; source: string | null; published_at: string } | null;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v == null ? null : JSON.stringify(v));
const HEX = /^#[\da-f]{6}$/i;
export const hueOf = (hex: unknown) => (typeof hex === "string" && HEX.test(hex) ? colorTicker(hex).split("·")[0]! : null);

/** Group events by confirmed change (domain, source, snapshot) and keep identity-level ones. */
export function identityChanges(events: EventIn[]) {
  const groups = new Map<string, EventIn[]>();
  for (const e of events) { if (e.snapshot_id == null) continue; const k = `${e.source}|${e.domain}|${e.snapshot_id}`; groups.set(k, [...(groups.get(k) ?? []), e]); }
  const out: { key: string; events: EventIn[]; reasons: RebrandReason[]; fields: string[] }[] = [];
  for (const [key, list] of groups) {
    const reasons = new Set<RebrandReason>(), fields = new Set<string>();
    for (const e of list) {
      if (!(MEASURED_EVENT_TYPES as readonly string[]).includes(e.type)) continue;
      const b = obj(e.before), a = obj(e.after);
      for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) if (!AI_KEYS.has(f) && norm(a[f]) !== norm(b[f])) fields.add(f);
      if (e.type === "redesign") reasons.add("redesign");
      if (e.type === "theme_flip" || ("theme" in a && norm(a["theme"]) !== norm(b["theme"]))) reasons.add("theme");
      for (const f of ["h1", "body"]) if (f in a && norm(a[f]) !== norm(b[f])) reasons.add("font");
      const ha = hueOf(a["accent"]), hb = hueOf(b["accent"]); if (ha && hb && ha !== hb) reasons.add("accent");
      const pa = Array.isArray(a["palette"]) ? hueOf(a["palette"][0]) : null, pb = Array.isArray(b["palette"]) ? hueOf(b["palette"][0]) : null; if (pa && pb && pa !== pb) reasons.add("palette");
    }
    if (fields.size >= REDESIGN_MIN_FIELDS) reasons.add("redesign");
    if (reasons.size) out.push({ key, events: [...list].sort((x, y) => x.id - y.id), reasons: REBRAND_REASONS.filter(r => reasons.has(r)), fields: [...fields].sort() });
  }
  return out;
}

const STAGE_WORD: Record<string, string> = { emerging: "emerging", accelerating: "rising", flat: "flat", peaking: "peaking", declining: "fading" };
const GAIN_ORDER = ["emerging", "accelerating", "flat", "peaking", "declining"], LOSS_ORDER = ["peaking", "declining", "flat", "accelerating", "emerging"];
export function traitLabel(trait: string) {
  const [d = "", v = ""] = trait.split(":"), w = v.replace(/_/g, " ");
  if (trait === "headline:serif") return "serif headline";
  if (d === "theme") return `${w} theme`; if (d === "hero_media") return `${w} hero`; if (d === "aesthetic") return `${w} aesthetic`; if (d === "tone") return `${w} tone`; if (d === "hero_layout") return `${w} hero layout`;
  return w;
}
export const AI_TRAIT_DIMS = new Set(["aesthetic", "tone", "hero_layout", "imagery", "components", "color_mood", "ai_positioning"]);
const sideTraits = (s: Side) => new Set(siteTraits({ domain: "", quarter: "", sector: "", theme: s.theme, h1_family: s.h1, hero_media: s.hero_media, ai_tags: s.tags ? { aesthetic: s.tags.aesthetic, tone: s.tags.tone, hero_layout: s.tags.hero_layout } : null }));
function stageOf(trait: string, sector: string, fc: Map<string, ForecastIn>): TraitStage {
  const r = [fc.get(`${sector}|${trait}`), fc.get(`all|${trait}`)].find(x => x && x.status === "ok") ?? null;
  return { trait, label: traitLabel(trait), scope: r?.scope ?? "all", stage: r?.stage ?? null, share: r?.current_share ?? null, momentum: r?.momentum ?? null };
}
/** Deterministic one-line read from forecast stages, e.g. "moved from peaking dark theme to rising serif headline — ahead of 82% of fintech". */
export function readLine(before: Side, after: Side, sector: string, fc: Map<string, ForecastIn>) {
  // AI-tag traits only count when both captures carry valid tags; a missing tag set is unknown, not a change.
  const tagged = !!before.tags && !!after.tags, keep = (t: string) => tagged || !AI_TRAIT_DIMS.has(t.slice(0, t.indexOf(":")));
  const b = new Set([...sideTraits(before)].filter(keep)), a = new Set([...sideTraits(after)].filter(keep));
  const rank = (order: string[]) => (x: TraitStage, y: TraitStage) => order.indexOf(x.stage ?? "") - order.indexOf(y.stage ?? "") || (y.momentum ?? 0) - (x.momentum ?? 0) || x.trait.localeCompare(y.trait);
  const gained = [...a].filter(t => !b.has(t)).map(t => stageOf(t, sector, fc)), lost = [...b].filter(t => !a.has(t)).map(t => stageOf(t, sector, fc));
  const g = gained.filter(t => t.stage).sort(rank(GAIN_ORDER))[0], l = lost.filter(t => t.stage).sort(rank(LOSS_ORDER))[0];
  const font = before.h1 && after.h1 && norm(before.h1) !== norm(after.h1) ? `${before.h1} → ${after.h1}` : null;
  const st = (t: TraitStage) => `${STAGE_WORD[t.stage ?? ""] ?? t.stage} ${t.label}`;
  let move = g && l ? `moved from ${st(l)} to ${st(g)}` : g ? `adopted ${st(g)}` : l ? `dropped ${st(l)}` : null;
  if (move && g && g.share != null) { const where = g.scope === "all" ? "the library" : g.scope; move += g.stage === "emerging" || g.stage === "accelerating" ? ` — ahead of ${Math.round((1 - g.share) * 100)}% of ${where}` : ` — joins ${Math.round(g.share * 100)}% of ${where}`; }
  const ha = hueOf(after.accent), hb = hueOf(before.accent);
  const accent = ha && hb && ha !== hb ? `accent ${hb} → ${ha}` : null, theme = before.theme && after.theme && before.theme !== after.theme ? `${before.theme} → ${after.theme} theme` : null;
  const read = [font ? `headline ${font}` : null, accent, theme, move].filter(Boolean).join("; ") || "identity change; no forecast trait moved";
  return { read: read.slice(0, 220), new_traits: gained.sort(rank(GAIN_ORDER)) };
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Brand pattern: the site name (case-insensitive), else the capitalized domain stem ("Airbnb" for airbnb.com, ≥5 letters) so common words like "notion" don't match. */
export function brandPattern(domain: string, name: string | null) {
  if (name && name.length >= 4) return new RegExp(`(^|[^\\p{L}\\p{N}])${esc(name)}($|[^\\p{L}\\p{N}])`, "iu");
  const stem = domain.replace(/^www\./, "").split(".")[0] ?? "";
  if (!/^[a-z][a-z0-9-]{4,}$/.test(stem)) return null;
  const cap = stem[0]!.toUpperCase() + stem.slice(1);
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(cap)}|${esc(stem.toUpperCase())})($|[^\\p{L}\\p{N}])`, "u");
}
export function wireMatch(domain: string, name: string | null, at: string, wire: WireIn[]) {
  const t = Date.parse(at), brand = brandPattern(domain, name);
  const hits = wire.filter(w => w.source_kind !== "alert" && Math.abs(Date.parse(w.published_at) - t) <= WIRE_MATCH_DAYS * 864e5).filter(w => { const text = `${w.title ?? ""} ${w.excerpt ?? ""}`; return text.toLowerCase().includes(domain.toLowerCase()) || (brand?.test(text) ?? false); });
  const w = hits.sort((x, y) => Math.abs(Date.parse(x.published_at) - t) - Math.abs(Date.parse(y.published_at) - t) || x.id - y.id)[0];
  return w ? { title: w.title ?? w.url, url: w.url, source: w.source, published_at: w.published_at } : null;
}
const toSide = (s: SideIn | undefined, google: Set<string>): Side => ({ snapshot_id: s?.id ?? null, captured_at: s?.captured_at ?? null, h1: s?.h1 ?? null, body: s?.body ?? null, theme: s?.theme ?? null, bg: s?.bg ?? null, accent: s?.accent ?? null, palette: (s?.palette ?? []).slice(0, 3), hero_media: s?.hero_media ?? null, archive_url: s?.archive_url ?? null, tags: s?.tags ?? null, h1_google: !!s?.h1 && google.has(s.h1.toLowerCase()), body_google: !!s?.body && google.has(s.body.toLowerCase()) });

export function buildRebrands(input: { events: EventIn[]; sites: { domain: string; sector: string; name: string | null }[]; snapshots: SideIn[]; forecasts: ForecastIn[]; wire: WireIn[]; google: Set<string> }): Rebrand[] {
  const sites = new Map(input.sites.map(s => [s.domain, s])), snaps = new Map(input.snapshots.map(s => [s.id, s]));
  const fc = new Map(input.forecasts.map(f => [`${f.scope}|${f.dimension}:${f.value}`, f]));
  const out: Rebrand[] = [];
  for (const g of identityChanges(input.events)) {
    const e0 = g.events[0]!, site = sites.get(e0.domain); if (!site) continue;
    // First seen = event effective_at; confirmed = the confirming capture (the event's snapshot), falling back to first seen.
    const effective = g.events.map(e => e.effective_at).sort().at(-1)!, after0 = snaps.get(e0.snapshot_id ?? -1), confirmed = after0?.captured_at && after0.captured_at >= effective ? after0.captured_at : effective, before = toSide(snaps.get(e0.prev_snapshot_id ?? -1), input.google), after = toSide(snaps.get(e0.snapshot_id ?? -1), input.google);
    const source = e0.source === "wayback" ? "archive" : "live", { read, new_traits } = readLine(before, after, site.sector, fc);
    out.push({ id: `${source}-${e0.snapshot_id}`, domain: e0.domain, sector: site.sector, name: site.name, source, confirmed_at: confirmed, effective_at: effective, detected_at: g.events.map(e => e.detected_at).sort().at(-1)!, reasons: g.reasons, fields: g.fields, event_ids: g.events.map(e => e.id), before, after, read, new_traits,
      links: { library: `/library/${e0.domain}`, archive: source === "archive" ? after.archive_url : null, archive_before: source === "archive" ? before.archive_url : null }, wire: wireMatch(e0.domain, site.name, confirmed, input.wire) });
  }
  return out.filter(r => r.confirmed_at >= REBRAND_SINCE).sort((a, b) => b.confirmed_at.localeCompare(a.confirmed_at) || a.domain.localeCompare(b.domain));
}
export const quarterOf = (iso: string) => { const d = new Date(iso); return `${d.getUTCFullYear()}Q${Math.floor(d.getUTCMonth() / 3) + 1}`; };
export function rebrandCounts(rows: Pick<Rebrand, "confirmed_at" | "source">[], now = new Date()) {
  const q = quarterOf(now.toISOString());
  return { total: rows.length, live: rows.filter(r => r.source === "live").length, archive: rows.filter(r => r.source === "archive").length, this_quarter: rows.filter(r => quarterOf(r.confirmed_at) === q).length, quarter: q };
}
export function filterRebrands<T extends Pick<Rebrand, "sector" | "source" | "confirmed_at">>(rows: T[], f: { sector?: string | undefined; source?: "live" | "archive" | undefined; year?: number | undefined; since?: string | undefined }) {
  return rows.filter(r => (!f.sector || f.sector === "all" || r.sector === f.sector) && (!f.source || r.source === f.source) && (!f.year || r.confirmed_at.startsWith(String(f.year))) && (!f.since || r.confirmed_at >= f.since));
}
