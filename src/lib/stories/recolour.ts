// U2b · colour words are facts, on the page too. A single-brand story's stored palette or accent line was worded with the colour names
// of its day; the list shows the same change with today's one naming function (`hexName`), from the change's own stored hexes, so the
// written text and the list name a colour the same way. Only the words before " · " change; the dates stay. Pure.
import { hexName } from "../agency/changes";
import { colours } from "../tape";
import type { Fact } from "./types";

export type ColourEvent = { type: string; before: unknown; after: unknown };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
/** "Palette, A to B" and "Accent, A to B" from the story's one palette change (none or several: nothing to reword). */
export function colourHeads(events: ColourEvent[]): { palette?: string; accent?: string } {
  const p = events.filter(e => e.type === "palette_shift"); if (p.length !== 1) return {};
  const b = o(p[0]!.before), a = o(p[0]!.after), out: { palette?: string; accent?: string } = {};
  if ("palette" in a || "palette" in b) out.palette = `Palette, ${colours(b["palette"])} to ${colours(a["palette"])}`;
  if ("accent" in a || "accent" in b) out.accent = `Accent, ${hexName(b["accent"])} to ${hexName(a["accent"])}`;
  return out;
}
/** W1d · a single accent change's "Before: <name>" and "After: <name>" lines, named by today's function from the change's own hexes. */
function sides(events: ColourEvent[]): { before: string; after: string } | null {
  const p = events.filter(e => e.type === "palette_shift"); if (p.length !== 1) return null;
  const b = o(p[0]!.before), a = o(p[0]!.after);
  if ("palette" in a || "palette" in b || typeof b["accent"] !== "string" || typeof a["accent"] !== "string") return null;
  return { before: hexName(b["accent"]), after: hexName(a["accent"]) };
}
/** A colour name as stored on a before/after line: one to three words, no digits, no list or date. */
const NAME_ONLY = /^[A-Z][a-z-]+(?: [a-z-]+){0,2}$/;
export function recolour(facts: Fact[], events: ColourEvent[]): Fact[] {
  const h = colourHeads(events), ba = sides(events); if (!h.palette && !h.accent && !ba) return facts;
  return facts.map(f => {
    if (ba && (f.kind === "before" || f.kind === "after")) {
      const name = f.text.replace(/^(?:Before|After): /, "");
      return NAME_ONLY.test(name) ? { ...f, text: `${f.kind === "before" ? "Before" : "After"}: ${ba[f.kind]}` } : f;
    }
    if (f.kind !== "member") return f;
    const cut = f.text.indexOf(" · "), head = cut >= 0 ? f.text.slice(0, cut) : f.text, tail = cut >= 0 ? f.text.slice(cut) : "";
    const next = h.palette && /^Palette, /.test(head) ? h.palette : h.accent && /^Accent, /.test(head) ? h.accent : null;
    return next ? { ...f, text: `${next}${tail}` } : f;
  });
}
