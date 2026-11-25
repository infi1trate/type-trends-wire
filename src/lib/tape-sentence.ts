// V3 · a change line as one plain sentence (Voice guide 2, examples 8 and 9): the brand by name, what changed, from what to what, where.
// Built by rule from the stored fields only, no model call. A change type without a rule here returns null and keeps the terse line
// (the Terminal view and data outputs always keep the terse form). Pure.
import type { EventRow } from "./agency/changes";
import { hexName } from "./agency/changes";
import { oneHeadline } from "./headline-text";

type E = Pick<EventRow, "type" | "before" | "after" | "page_type" | "summary">;
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const has = (x: Record<string, unknown>, y: Record<string, unknown>, k: string) => k in x || k in y;
/** "homepage", "about page", "product page". */
const one = (p: string) => (p === "home page" || p === "home" ? "homepage" : p.endsWith(" page") ? p : `${p} page`);
/** "homepage", "about page", "homepage and about page". */
export const whereWords = (page: string | null | undefined, pages?: readonly string[]) => (pages && pages.length > 1 ? pages.map(one).join(", ").replace(/, ([^,]+)$/, " and $1") : page && page !== "home" ? `${page} page` : "homepage");
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const HERO: Record<string, string> = { image: "a still picture", video: "a video", webgl: "a 3D scene", canvas: "a 3D scene", none: "no picture" };
const heroWords = (v: unknown) => (v == null || v === "" ? "no picture" : HERO[String(v)] ?? null);
const ALIGN: Record<string, string> = { left: "left", center: "centred", centre: "centred", right: "right" };
const px = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v) ? Number(v) : null);
const quote = (v: unknown, n = 70) => { const t = str(v); if (!t) return null; const l = oneHeadline(t); return `“${l.length > n ? `${l.slice(0, n - 1)}…` : l}”`; };

/** One sentence per change, or null when there is no rule for it. `name` is the brand's stored name. */
export function tapeSentence(e: E, name: string, pages?: readonly string[]): string | null {
  const b = o(e.before), a = o(e.after), where = whereWords(e.page_type, pages), its = `${name}'s ${where}`, many = !!pages && pages.length > 1;
  const v = (one: string, more: string) => (many ? more : one);
  switch (e.type) {
    case "type_change": {
      const h = has(a, b, "h1") ? { from: str(b["h1"]), to: str(a["h1"]) } : null, t = has(a, b, "body") ? { from: str(b["body"]), to: str(a["body"]) } : null;
      if (h && t && h.to && h.to === t.to && h.from && t.from && h.from !== t.from) return `${its} now ${v("speaks", "speak")} in one typeface, ${h.to}, where ${v("it", "they")} used to use two: ${h.from} for headlines and ${t.from} for text.`;
      if (h && t && h.to && t.to && h.from && t.from) return `${name} changed both typefaces on its ${where}: headlines from ${h.from} to ${h.to}, text from ${t.from} to ${t.to}.`;
      if (h && !t && h.to && h.from) return `${its} headlines are now set in ${h.to}, where they used to be in ${h.from}.`;
      if (t && !h && t.to && t.from) return `${its} text is now set in ${t.to}, where it used to be in ${t.from}.`;
      return null;
    }
    case "message_pivot": { const f = quote(b["headline"]), t = quote(a["headline"]); return f && t ? `${its} headline changed from ${f} to ${t}.` : null; }
    case "theme_flip": { const f = str(b["theme"]), t = str(a["theme"]); return f && t && /^(light|dark)$/.test(f) && /^(light|dark)$/.test(t) ? `${its} turned ${t}, where it used to be ${f}.` : null; }
    case "palette_shift": {
      if (!("accent" in a || "accent" in b) || "palette" in a || "palette" in b) return null;
      const f = hexName(b["accent"] as never), t = hexName(a["accent"] as never);
      return f && t && f !== t ? `${its} accent changed from ${lc(f)} to ${lc(t)}.` : null;
    }
    case "layout_change": {
      const out: string[] = [];
      for (const k of Object.keys({ ...b, ...a })) {
        if (k === "hero_media") { const f = heroWords(b[k]), t = heroWords(a[k]); if (!f || !t) return null; out.push(`${its} first screen now shows ${t}, where it used to show ${f}.`); }
        else if (k === "h1_align") { const f = ALIGN[String(b[k])], t = ALIGN[String(a[k])]; if (!f || !t) return null; out.push(`${its} headline now sits ${t === "centred" ? "centred" : `on the ${t}`}, where it used to sit ${f === "centred" ? "centred" : `on the ${f}`}.`); }
        else if (k === "cta_radius_px") {
          const f = b[k], t = a[k];
          if (f === "pill" && t !== "pill" && t != null) out.push(`${name} squared off its buttons a little. The pill on its ${where} is now a rounded rectangle.`);
          else if (t === "pill" && f !== "pill") out.push(`${name} rounded its buttons into pills on its ${where}.`);
          else if (px(t) === 0) out.push(`${name} gave the buttons on its ${where} square corners.`);
          else return null;
        }
        else if (k === "grid_max_cols") { const f = px(b[k]), t = px(a[k]); if (f == null || t == null) return null; out.push(`${its} grid now runs to ${t} columns, where it used to run to ${f}.`); }
        else return null;
      }
      return out.length ? out.join(" ") : null;
    }
    default: return null;
  }
}
