// Changes that bounce back (pure, no I/O): an event that changes a field from A to B, followed within seven days by an event on the
// same domain, page type and viewport that changes that field back to A, is a test or rotating content, not a move. Both events of the
// pair are marked (the first "reversed", the second "the reversal"); a third flip marks again. Values compare with the library's own
// field equality, so a near-identical colour or a renamed font file reads as "the same value".
import { equalField } from "./library-diff";

/** The window: the change back must come within this many days of the first change. */
export const REVERSAL_DAYS = 7;
/** Fields compared: hero media, theme, accent, palette, headline copy, headline font, body font, headline alignment, button corners, grid columns. */
export const REVERSAL_FIELDS = ["hero_media", "theme", "accent", "palette", "headline", "h1", "body", "h1_align", "cta_radius_px", "grid_max_cols"] as const;
export const REVERSED_REASON = "Reversed within seven days";
export const REVERSED_LABEL = "Reversed";
export const REVERSED_RULE = `A change that is changed back within ${REVERSAL_DAYS} days (a theme, accent, palette, hero, headline, font, alignment, button corners or grid columns that returns to its earlier value on the same page) is a test or rotating content, not a move: both changes stay in the data, marked Reversed, and never run as stories or count toward a roundup.`;

export type ReversalEvent = { id: number; domain: string; page_type?: string | null; viewport?: string | null; detected_at: string; before: unknown; after: unknown };
export type ReversalMark = { reversed: boolean; reversal: boolean; fields: string[] };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const val = (o: Record<string, unknown>, k: string) => (has(o, k) ? o[k] ?? null : null);

/** Marks per event id, for events in any order (they are grouped by domain, page type and viewport and read in time order). */
export function reversalMarks(events: readonly ReversalEvent[]): Map<number, ReversalMark> {
  const out = new Map<number, ReversalMark>(), groups = new Map<string, ReversalEvent[]>();
  for (const e of events) { const k = `${e.domain}|${e.page_type ?? "home"}|${e.viewport ?? "desktop"}`; groups.set(k, [...(groups.get(k) ?? []), e]); }
  const mark = (id: number, side: "reversed" | "reversal", field: string) => {
    const m = out.get(id) ?? { reversed: false, reversal: false, fields: [] };
    m[side] = true; if (!m.fields.includes(field)) m.fields.push(field);
    out.set(id, m);
  };
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id);
    for (const f of REVERSAL_FIELDS) {
      // The events that changed this field, in time order: each one is compared with the next change to the same field.
      const changes = sorted.filter(e => { const b = obj(e.before), a = obj(e.after); return (has(b, f) || has(a, f)) && !equalField(f, val(b, f), val(a, f)); });
      for (let i = 0; i + 1 < changes.length; i++) {
        const first = changes[i]!, next = changes[i + 1]!, gap = Date.parse(next.detected_at) - Date.parse(first.detected_at);
        if (!(gap > 0 && gap <= REVERSAL_DAYS * 864e5)) continue;
        if (equalField(f, val(obj(next.after), f), val(obj(first.before), f))) { mark(first.id, "reversed", f); mark(next.id, "reversal", f); }
      }
    }
  }
  return out;
}
/** Ids of every marked event (reversed or the reversal). */
export const reversalIds = (events: readonly ReversalEvent[]) => new Set(reversalMarks(events).keys());
