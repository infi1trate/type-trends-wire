// I3 · 0.1 / 0.5 — when a stored change is not a change. Pure: same captures in, same marks out.
//  • A re-read: a change in an AI-read look field (aesthetic, imagery) counts only when at least one measured look field
//    (palette roles or accent, type families, hero kind, theme, layout or grid) also differs between the same two captures of that
//    brand, page and viewport. A different headline or content hash alone does not qualify. Otherwise the new labels simply replace the
//    old ones in current-state reads: no event, no tape line, no count, no story.
//  • A measurement failure: a grid of 0 columns means no column grid was detected (the crawler's max over detected CSS grids, 0 when
//    none), and a "monthly price" below one cent or with more than two decimals is a percentage fee or a parsing failure, not a price.
// Marks never delete or rewrite an event; they sit beside it (library_event_marks) and every verdict read applies them (integrity.ts).
import { equalField, normalizeFont, validMonthly, type Comparable } from "./library-diff";
export { validMonthly };

/** Fields whose value comes from an AI read of how the page looks (vision labels). AI-read pricing reads page text, so a new price is
 *  not required to change the look; it is held to the price rule below instead. */
export const AI_FIELDS: ReadonlySet<string> = new Set(["imagery", "aesthetic"]);
/** Measured look fields (library-diff's extracted names): type families, theme, accent and palette, hero kind, headline alignment,
 *  grid columns and button radius. Headline text, nav, prices and stack are not "look". */
export const LOOK_FIELDS = ["h1", "body", "theme", "accent", "palette", "hero_media", "h1_align", "grid_max_cols", "cta_radius_px"] as const;
export type MarkKind = "reread" | "not_measured";
export type Mark = { kind: MarkKind; reason: string };
export const MARK_REASON = {
  sameLook: "re-read: no measured look field differs between the two captures",
  noPair: "re-read: the two captures behind it are not both stored, so no measured look change can be shown",
  noGrid: "no column grid detected in one capture (a detection gap, not 0 columns)",
  notPrice: "not a monthly price (a percentage fee or a parsing failure)",
} as const;

const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const fontOf = (v: unknown) => { const r = o(v); return r["substituted"] === true ? null : typeof r["family"] === "string" ? normalizeFont(r["family"]) || null : null; };

/** True when at least one measured look field is present on both sides and differs (fonts by family, never a substituted fallback). */
export function lookDiffers(a: Comparable, b: Comparable): boolean {
  for (const f of LOOK_FIELDS) {
    const x = a[f], y = b[f];
    if (x == null || y == null) continue;
    if (f === "h1" || f === "body") { const fx = fontOf(x), fy = fontOf(y); if (fx && fy && fx !== fy) return true; continue; }
    if (f === "grid_max_cols" && (x === 0 || y === 0)) continue;
    if (!equalField(f, x, y)) return true;
  }
  return false;
}

const priceOk = (v: unknown) => validMonthly(o(v)["cheapest_paid_monthly"]);

type Cap = { id: number; fields: Comparable };
type Ev = { type: string; before?: unknown; after?: unknown; snapshot_id?: number | null; prev_snapshot_id?: number | null };
type Seen = { lastBefore?: string; firstAfter?: string };
/** The fields of one stored change that are not a change, with why (empty: every field is judged as usual). "The same two captures"
 *  are the field's own transition pair from the integrity check (the last capture with the old labels and the first with the new
 *  ones); a field without one falls back to the change's stored pair. The AI baseline can be days older than the transition, so
 *  comparing against it would credit the labels with look changes that happened in between. */
export function eventMarks(e: Ev, captures: readonly (Cap & { at?: string })[], seen: Readonly<Record<string, Seen>> = {}): Record<string, Mark> {
  const b = o(e.before), a = o(e.after), out: Record<string, Mark> = {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const pairOf = (k: string) => {
    const s = seen[k];
    if (s?.lastBefore && s.firstAfter) return [captures.find(c => c.at === s.lastBefore), captures.find(c => c.at === s.firstAfter)] as const;
    return [captures.find(c => c.id === e.prev_snapshot_id), captures.find(c => c.id === e.snapshot_id)] as const;
  };
  for (const k of keys) {
    if (k === "grid_max_cols" && (b[k] === 0 || a[k] === 0)) { out[k] = { kind: "not_measured", reason: MARK_REASON.noGrid }; continue; }
    if (k === "ai_pricing" && (!priceOk(b[k]) || !priceOk(a[k]))) { out[k] = { kind: "not_measured", reason: MARK_REASON.notPrice }; continue; }
    if (!AI_FIELDS.has(k)) continue;
    const [prev, cur] = pairOf(k);
    if (!prev || !cur) { out[k] = { kind: "reread", reason: MARK_REASON.noPair }; continue; }
    if (!lookDiffers(prev.fields, cur.fields)) out[k] = { kind: "reread", reason: MARK_REASON.sameLook };
  }
  return out;
}

/** I3 · 0.1.5 — the tag intake may copy the previous read when the page's measured look and content hash are unchanged. */
export function sameLookAndContent(prev: { fields: Comparable; content_hash: string | null }, cur: { fields: Comparable; content_hash: string | null }): boolean {
  if (!prev.content_hash || prev.content_hash !== cur.content_hash) return false;
  for (const f of LOOK_FIELDS) {
    const x = prev.fields[f] ?? null, y = cur.fields[f] ?? null;
    if (x == null && y == null) continue;
    if (x == null || y == null) return false;
    if (f === "h1" || f === "body") { if (fontOf(x) !== fontOf(y)) return false; continue; }
    if (!equalField(f, x, y)) return false;
  }
  return true;
}

/** "Re-read on 21 Nov 2026. No measured change." — the Data view's line for a re-read. */
export const rereadLine = (date: string) => `Re-read on ${date}. No measured change.`;
