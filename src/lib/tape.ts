// THE TAPE — every confirmed live change as one plain line: brand name, what changed, from and to, date, and its label (Seasonal,
// Reversed). No adjectives, no story page. "Rivian · hero, video to still · 11 Nov". Pure; names from brand-names.ts.
import { hexName, type EventRow } from "./agency/changes";
import { brandName } from "./brand-names";
import { label } from "./labels";
import { SEASONAL_LABEL } from "./promo";
import { REVERSED_LABEL } from "./reversal";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const tapeDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const quote = (t: string | null, n = 70) => (t ? `“${t.length > n ? `${t.slice(0, n - 1)}…` : t}”` : "none");
/** Hero media in plain words: an image hero is a still. */
const HERO: Record<string, string> = { image: "still", video: "video", webgl: "3D", none: "none", canvas: "3D" };
const hero = (v: unknown) => (v == null || v === "" ? "none" : HERO[String(v)] ?? String(v).replace(/_/g, " "));
const align = (v: unknown) => (v == null || v === "" ? "none" : String(v));
const corners = (v: unknown) => (v === "pill" ? "pill" : v === "0" || v === 0 ? "square" : v == null ? "none" : `${String(v)} px`);
const colours = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).slice(0, 2).map(hexName))].join(" and ") || "none";
const tags = (dim: string, v: unknown) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []).filter((x): x is string => typeof x === "string").map(x => label(`${dim}:${x}`).name.toLowerCase()).join(", ") || "none";

/** What changed, from and to, in plain words ("hero, video to still"; "headline font, Futura PT to Akkurat LL"). */
export function tapeWhat(e: Pick<EventRow, "type" | "before" | "after" | "page_type" | "summary">): string {
  const b = o(e.before), a = o(e.after);
  const parts: string[] = [];
  switch (e.type) {
    case "palette_shift":
      if ("accent" in a || "accent" in b) parts.push(`accent, ${hexName(b["accent"])} to ${hexName(a["accent"])}`);
      if ("palette" in a || "palette" in b) parts.push(`palette, ${colours(b["palette"])} to ${colours(a["palette"])}`);
      break;
    case "type_change":
      if ("h1" in a || "h1" in b) parts.push(`headline font, ${str(b["h1"]) ?? "none"} to ${str(a["h1"]) ?? "none"}`);
      if ("body" in a || "body" in b) parts.push(`body font, ${str(b["body"]) ?? "none"} to ${str(a["body"]) ?? "none"}`);
      break;
    case "theme_flip": parts.push(`theme, ${str(b["theme"]) ?? "none"} to ${str(a["theme"]) ?? "none"}`); break;
    case "message_pivot": parts.push(`headline, ${quote(str(b["headline"]))} to ${quote(str(a["headline"]))}`); break;
    case "layout_change": case "redesign":
      for (const k of Object.keys({ ...b, ...a })) {
        if (k === "hero_media") parts.push(`hero, ${hero(b[k])} to ${hero(a[k])}`);
        else if (k === "h1_align") parts.push(`headline alignment, ${align(b[k])} to ${align(a[k])}`);
        else if (k === "grid_max_cols") parts.push(`grid, ${String(b[k] ?? 0)} to ${String(a[k] ?? 0)} columns`);
        else if (k === "cta_radius_px") parts.push(`button corners, ${corners(b[k])} to ${corners(a[k])}`);
        else if (e.type === "redesign") continue;
        else parts.push(`${k.replace(/_/g, " ")}, ${String(b[k] ?? "none")} to ${String(a[k] ?? "none")}`);
      }
      if (e.type === "redesign") return `homepage redesign (${Object.keys(a).length || "several"} fields at once)`;
      break;
    case "imagery_shift": case "aesthetic_shift": { const dim = e.type === "imagery_shift" ? "imagery" : "aesthetic"; parts.push(`${dim} (AI estimate), ${tags(dim, b[dim])} to ${tags(dim, a[dim])}`); break; }
    case "pricing_change": {
      const before = (Array.isArray(b["prices"]) ? b["prices"] : []).map(String), after = (Array.isArray(a["prices"]) ? a["prices"] : []).map(String);
      const added = after.filter(p => !before.includes(p)), removed = before.filter(p => !after.includes(p));
      parts.push(`pricing${added.length ? `, added ${added.slice(0, 3).join(", ")}` : ""}${removed.length ? `, removed ${removed.slice(0, 3).join(", ")}` : ""}`.replace(/\$/g, "USD "));
      break;
    }
    case "new_surface": parts.push(`new ${str(a["page_type"]) ?? e.page_type ?? "page"} page`); break;
    case "stack_change": { const k = Object.keys(a)[0] ?? "stack"; parts.push(`stack, ${k.replace(/^tech\./, "")} ${a[k] === true ? "added" : a[k] === false ? "removed" : "changed"}`); break; }
    case "nav_change": parts.push("navigation"); break;
    default: parts.push(str(e.summary) ?? e.type.replace(/_/g, " "));
  }
  const page = e.page_type && e.page_type !== "home" && e.type !== "new_surface" ? ` (${e.page_type} page)` : "";
  return `${parts.join("; ") || e.type.replace(/_/g, " ")}${page}`;
}
export type TapeLabels = { seasonal?: boolean; reversed?: boolean };
/** The labels a tape line carries. */
export const tapeLabels = (l: TapeLabels) => [...(l.seasonal ? [SEASONAL_LABEL] : []), ...(l.reversed ? [REVERSED_LABEL] : [])];
/** One tape line: "Rivian · hero, video to still · 11 Nov" (plus " · Seasonal" / " · Reversed"). */
export function tapeLine(e: Pick<EventRow, "domain" | "type" | "before" | "after" | "page_type" | "summary" | "detected_at">, l: TapeLabels = {}, name?: string | null): string {
  return [brandName(e.domain, name), tapeWhat(e), tapeDate(e.detected_at), ...tapeLabels(l)].join(" · ");
}
