export type LibraryEventType = "type_change" | "palette_shift" | "theme_flip" | "layout_change" | "redesign" | "message_pivot" | "pricing_change" | "new_surface" | "stack_change" | "nav_change" | "imagery_shift" | "aesthetic_shift";
export type LibraryEvent = { type: LibraryEventType; severity: 1 | 2 | 3; summary: string; before: Record<string, unknown>; after: Record<string, unknown>; effective_at?: string; prev_snapshot_id?: number | null };
export type Comparable = Record<string, unknown>;
export type Pending = Record<string, { from: unknown; to: unknown; first_seen_snapshot_id: number | null; first_seen_at: string }>;
export type Baseline = { signals: Comparable; snapshot_id: number | null; confirmed_at: string };
export type DiffContext = { page_type: string; viewport: string; source?: string; sector?: string; prev_content_hash?: string | null | undefined; content_hash?: string | null | undefined; new_surface?: boolean; first_captured_at?: string | null | undefined; captured_at?: string | undefined; snapshot_id?: number | null };
const record = (value: unknown): Comparable => value && typeof value === "object" && !Array.isArray(value) ? value as Comparable : {};
const at = (value: unknown, ...path: string[]): unknown => path.reduce((v, key) => record(v)[key], value);
const text = (value: unknown) => typeof value === "string" ? value : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const display = (value: unknown) => String(value ?? "—").slice(0, 160);
const jaccard = (a: string[], b: string[]) => { const x = new Set(a), y = new Set(b), union = new Set([...x, ...y]); return union.size ? [...x].filter(v => y.has(v)).length / union.size : 1; };
const words = (value: string) => [...new Set(value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
export const frameworks = ["next", "nuxt", "framer", "webflow", "wordpress", "shopify", "squarespace", "wix", "astro", "gatsby", "sveltekit"];
const blockedHeadline = /cookie|privacy|consent|subscribe|sign in|log in|404|not found|access denied|just a moment/i;
/** A captured headline that is a banner, wall or error page, not the page's own line (never compared as a headline). */
export const isBlockedHeadline = (text: string) => blockedHeadline.test(text);
export function normalizeFont(value: string): string {
  value = value.trim().replace(/^["']|["']$/g, "").replace(/^__(.+?)(?:_Fallback)?_[0-9a-f]{5,8}$/i, "$1").replace(/([a-z])([A-Z])/g, "$1 $2");
  // Suffixes may be concatenated (BasiersquareWebfont), spaced, or repeated.
  let key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  let previous;
  do { previous = key; key = key.replace(/(?:webfont|variable|display|text|web|vf|pro)$/, ""); } while (key !== previous);
  return key;
}
const bucket = (value: unknown) => { const r = number(value); return r == null ? null : r === 0 ? "0" : r <= 8 ? "1–8" : r <= 24 ? "9–24" : "pill"; };
function lab(hex: string): number[] | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r = 0, g = 0, b = 0] = rgb;
  const xyz = [(r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047, r * 0.2126729 + g * 0.7151522 + b * 0.072175, (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883].map(v => v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116);
  const [x = 0, y = 0, z = 0] = xyz;
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
export function deltaE76(a: string, b: string): number | null {
  const first = lab(a), second = lab(b);
  return first && second ? Math.hypot(...first.map((v, i) => v - (second[i] ?? 0))) : null;
}
const validColors = (v: unknown) => Array.isArray(v) ? v.slice(0, 5).map(c => text(typeof c === "string" ? c : at(c, "hex"))).filter((c): c is string => c != null && lab(c) != null) : [];
const strings = (v: unknown) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string"))].sort() : [];
export function extractFields(signals: Comparable, context: DiffContext): Comparable {
  const fields: Comparable = {};
  for (const role of ["h1", "body"]) {
    const font = record(at(signals, "type", "rendered", role));
    if (typeof font['family'] === "string") fields[role] = { family: font['family'], webfont: font['webfont'] ?? null, substituted: font['substituted'] === true };
  }
  const theme = text(at(signals, "color", "theme")); if (theme != null) fields['theme'] = theme;
  if (context.viewport !== "desktop") return fields;
  const accent = text(at(signals, "color", "accent")); if (accent && lab(accent)) fields['accent'] = accent;
  const palette = validColors(at(signals, "color", "palette")); if (palette.length) fields['palette'] = palette;
  for (const key of ["hero_media", "h1_align", "grid_max_cols", "cta_radius_px"]) {
    const v = key === "cta_radius_px" ? bucket(at(signals, "layout", key)) : at(signals, "layout", key);
    if (v != null) fields[key] = v;
  }
  if (Array.isArray(signals['nav'])) fields['nav'] = strings(signals['nav'].filter(n => at(n, "depth") === 0).map(n => text(at(n, "label"))?.trim().toLowerCase()).filter(Boolean));
  const h1 = text(at(signals, "lexicon", "h1"));
  if (context.page_type === "home" && context.sector !== "media" && h1 && !blockedHeadline.test(h1)) fields['headline'] = h1;
  if (context.page_type === "pricing" && Array.isArray(signals['prices'])) fields['prices'] = strings(signals['prices']);
  if (context.page_type === "home" && at(signals,'ai_tags','low_confidence')!==true && !at(signals,'ai_tags','blocked_reason') && (number(at(signals,'ai_tags','confidence'))??1)>=0.4) for (const key of ["imagery", "aesthetic"]) {
    const tags = at(signals, "ai_tags", key); if (Array.isArray(tags)) fields[key] = strings(tags);
  }
  if (context.page_type === "pricing" && signals['ai_pricing']) fields['ai_pricing'] = signals['ai_pricing'];
  for (const flag of frameworks) { const v = at(signals, "tech", flag); if (typeof v === "boolean") fields[`tech.${flag}`] = v; }
  return fields;
}
export function equalField(field: string, a: unknown, b: unknown): boolean {
  if (field === "h1" || field === "body") return normalizeFont(String(at(a, "family") ?? "")) === normalizeFont(String(at(b, "family") ?? ""));
  if (field === "accent") return (deltaE76(String(a), String(b)) ?? 0) <= 25;
  if (field === "palette") { const old = validColors(a), next = validColors(b); return next.filter(c => old.every(p => (deltaE76(c, p) ?? 0) > 15)).length < 3; }
  if (field === "nav") return jaccard(strings(a), strings(b)) >= 0.6;
  if (field === "headline") return blockedHeadline.test(String(a)) || blockedHeadline.test(String(b)) || jaccard(words(String(a)), words(String(b))) >= 0.3;
  if (field === "prices") return JSON.stringify(strings(a)) === JSON.stringify(strings(b));
  if (field === "imagery" || field === "aesthetic") return jaccard(strings(a), strings(b)) >= 0.5;
  if (field === "ai_pricing") return at(a, "cheapest_paid_monthly") === at(b, "cheapest_paid_monthly") && JSON.stringify(strings(at(a, "plans"))) === JSON.stringify(strings(at(b, "plans")));
  return a === b;
}
export function ignoreField(field: string, value: unknown, baseline: unknown): boolean {
  return (field === "h1" || field === "body") && (at(value, "substituted") === true || at(value, "webfont") === false && at(baseline, "webfont") === true);
}
function eventType(field: string): LibraryEventType {
  if (field === "imagery") return "imagery_shift";
  if (field === "aesthetic") return "aesthetic_shift";
  if (field === "ai_pricing") return "pricing_change";
  if (field === "h1" || field === "body") return "type_change";
  if (field === "theme") return "theme_flip";
  if (field === "accent" || field === "palette") return "palette_shift";
  if (field === "nav") return "nav_change";
  if (field === "headline") return "message_pivot";
  if (field === "prices") return "pricing_change";
  if (field.startsWith("tech.")) return "stack_change";
  return "layout_change";
}
function summary(field: string, a: unknown, b: unknown): string {
  if (field === "ai_pricing") return `pricing ${display(at(a, "cheapest_paid_monthly"))}/mo [${strings(at(a, "plans")).join(", ")}] → ${display(at(b, "cheapest_paid_monthly"))}/mo [${strings(at(b, "plans")).join(", ")}]`;
  if (field === "h1" || field === "body") return `${field} ${display(at(a, "family"))} → ${display(at(b, "family"))}`;
  if (field === "prices") { const old = strings(a), next = strings(b); return `prices added: ${next.filter(p => !old.includes(p)).slice(0, 4).join(", ") || "—"}; removed: ${old.filter(p => !next.includes(p)).slice(0, 4).join(", ") || "—"}`; }
  const show = (v: unknown) => Array.isArray(v) ? v.join(", ").slice(0, 160) : display(v);
  return `${field.replace(/^tech\./, "").replace(/_/g, " ")} ${show(a)} → ${show(b)}`;
}
export function advance(baseline: Baseline | null, pending: Pending, next: { signals: Comparable; snapshot_id: number | null; captured_at: string; context: DiffContext }): { baseline: Baseline; pending: Pending; events: LibraryEvent[] } {
  const fields = extractFields(next.signals, next.context);
  if (!baseline) return { baseline: { signals: fields, snapshot_id: next.snapshot_id, confirmed_at: next.captured_at }, pending: {}, events: [] };
  const values = { ...baseline.signals }, candidates = { ...pending };
  const confirmed: { field: string; from: unknown; to: unknown; at: string }[] = [];
  for (const field of new Set([...Object.keys(fields), ...Object.keys(candidates)])) {
    const value = fields[field], old = values[field];
    // A missing/unreliable capture breaks consecutiveness, but cannot alter the baseline.
    if (value == null || ignoreField(field, value, old)) { delete candidates[field]; continue; }
    if (old == null) { values[field] = value; delete candidates[field]; continue; }
    if (equalField(field, old, value)) { delete candidates[field]; continue; }
    const candidate = candidates[field];
    if (candidate && equalField(field, candidate.to, value)) {
      confirmed.push({ field, from: old, to: value, at: candidate.first_seen_at });
      values[field] = value; delete candidates[field];
    } else candidates[field] = { from: old, to: value, first_seen_snapshot_id: next.snapshot_id, first_seen_at: next.captured_at };
  }
  const events: LibraryEvent[] = [];
  const groups = new Map<LibraryEventType, typeof confirmed>();
  for (const change of confirmed) { const type = eventType(change.field); groups.set(type, [...(groups.get(type) ?? []), change]); }
  for (const [type, changes] of groups) {
    const value = (c: typeof confirmed[number], side: "from" | "to") => c.field === "h1" || c.field === "body" ? at(c[side], "family") : c[side];
    events.push({ type, severity: type === "type_change" ? changes.length === 2 ? 3 : 2 : ["theme_flip", "message_pivot", "pricing_change", "stack_change"].includes(type) ? 2 : 1,
      summary: changes.map(c => summary(c.field, c.from, c.to)).join("; "), before: Object.fromEntries(changes.map(c => [c.field, value(c, "from")])), after: Object.fromEntries(changes.map(c => [c.field, value(c, "to")])), effective_at: changes.map(c => c.at).sort()[0] ?? next.captured_at, prev_snapshot_id: baseline.snapshot_id });
  }
  if (next.context.page_type === "home" && next.context.viewport === "desktop" && groups.size >= 3) events.push({ type: "redesign", severity: 3, summary: `home design → ${groups.size} signals changed`, before: Object.assign({}, ...events.map(e => e.before)), after: Object.assign({}, ...events.map(e => e.after)), effective_at: events.map(e => e.effective_at ?? next.captured_at).sort()[0] ?? next.captured_at, prev_snapshot_id: baseline.snapshot_id });
  return { baseline: { signals: values, snapshot_id: confirmed.length ? next.snapshot_id : baseline.snapshot_id, confirmed_at: confirmed.length ? next.captured_at : baseline.confirmed_at }, pending: candidates, events };
}
// Pairwise helper retained for rule tests and new-surface eligibility; ingestion uses advance.
export function diffLibrarySignals(prev: Comparable | null, next: Comparable, context: DiffContext): LibraryEvent[] {
  if (!prev) return context.source !== "wayback" && context.new_surface && context.first_captured_at && context.captured_at && Date.parse(context.captured_at) - Date.parse(context.first_captured_at) > 86400000 ? [{ type: "new_surface", severity: 1, summary: `${context.page_type} page added`, before: {}, after: { page_type: context.page_type } }] : [];
  const captured_at = context.captured_at ?? "2000-01-01T00:00:00Z";
  const baseline = { signals: extractFields(prev, context), snapshot_id: null, confirmed_at: captured_at };
  const candidate = advance(baseline, {}, { signals: next, captured_at, snapshot_id: null, context });
  return advance(baseline, candidate.pending, { signals: next, captured_at, snapshot_id: null, context }).events.map(({ effective_at, prev_snapshot_id, ...event }) => event);
}
