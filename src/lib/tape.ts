// THE TAPE — every confirmed live change as one plain line: brand name, what changed, from and to, date, and its label (Seasonal,
// Reversed, Carousel). No adjectives, no story page. "Rivian · hero, video to still · 11 Nov". Pure; names from brand-names.ts.
// E2g: the date is when the change happened by its captures ("between 11 and 14 Nov"), never the day it was confirmed.
import { hexName, type EventRow } from "./agency/changes";
import { brandName } from "./brand-names";
import { label } from "./labels";
import { SEASONAL_LABEL } from "./promo";
import { REVERSED_LABEL } from "./reversal";
import { CAROUSEL_LABEL } from "./carousel";
import { oneHeadline } from "./headline-text";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const tapeDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? iso : `${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`; };
/** E2g · two capture dates as one phrase: "14 Nov" when they are the same UTC day, "between 11 and 14 Nov", "between 30 Oct and 2 Nov". */
export function betweenDates(before: string, after: string): string {
  const a = new Date(before), b = new Date(after);
  if (Number.isNaN(+a) || Number.isNaN(+b)) return tapeDate(after);
  if (before.slice(0, 10) === after.slice(0, 10)) return tapeDate(after);
  return a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear() ? `between ${a.getUTCDate()} and ${tapeDate(after)}` : `between ${tapeDate(before)} and ${tapeDate(after)}`;
}
/** When a change happened, never when it was confirmed: between the last capture with the old value and the first with the new one
 *  (its integrity check), else, for a change without dated captures (archive, or a verdict stored before E2g), the day it was recorded. */
export const changeWhen = (e: { detected_at: string; seen?: { before: string; after: string } | null }) => (e.seen ? betweenDates(e.seen.before, e.seen.after) : tapeDate(e.detected_at));
/** A deck's range: "between 11 and 14 Nov", or "on 14 Nov" when both captures are the same day (E2h). */
export const rangeWords = (from: string, to: string) => { const w = betweenDates(from, to); return w.startsWith("between ") ? w : `on ${w}`; };
const MON_RE = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";
const DATE_PART = new RegExp(`^(?:between \\d{1,2}(?: ${MON_RE})? and \\d{1,2} ${MON_RE}|\\d{1,2} ${MON_RE})$`);
/** A change line without its date part (E2h): the same change dated by its captures or by its confirmation is the same line. */
export const undated = (text: string) => text.split(" · ").filter(p => !DATE_PART.test(p.trim())).join(" · ");
/** The day a change's new value was first captured (the end of its window), for sorting and ranges. */
export const changeAt = (e: { detected_at: string; seen?: { before: string; after: string } | null }) => e.seen?.after ?? e.detected_at;
/** The day the old value was last captured (the start of its window). */
export const changeFrom = (e: { detected_at: string; seen?: { before: string; after: string } | null }) => e.seen?.before ?? e.detected_at;
const o = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const line = (v: unknown) => { const t = str(v); return t ? oneHeadline(t) : null; };
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
    case "message_pivot": parts.push(`headline, ${quote(line(b["headline"]))} to ${quote(line(a["headline"]))}`); break;
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
export type TapeLabels = { seasonal?: boolean; reversed?: boolean; carousel?: boolean };
/** The labels a tape line carries. */
export const tapeLabels = (l: TapeLabels) => [...(l.seasonal ? [SEASONAL_LABEL] : []), ...(l.carousel ? [CAROUSEL_LABEL] : []), ...(l.reversed ? [REVERSED_LABEL] : [])];
/** One tape line: "Rivian · hero, video to still · 11 Nov" (plus " · Seasonal" / " · Carousel" / " · Reversed"). */
export function tapeLine(e: Pick<EventRow, "domain" | "type" | "before" | "after" | "page_type" | "summary" | "detected_at" | "seen">, l: TapeLabels = {}, name?: string | null): string {
  return [brandName(e.domain, name), tapeWhat(e), changeWhen(e), ...tapeLabels(l)].join(" · ");
}

// ONE LINE PER CHANGE (E2b) ----------------------------------------------------------------------------------------------------------
type TapeEvent = Pick<EventRow, "id" | "domain" | "type" | "before" | "after" | "page_type" | "summary" | "detected_at" | "seen"> & { viewport?: string | null };
const pageName = (p: string | null | undefined) => `${p && p !== "home" ? p : "home"} page`;
/**
 * The tape keeps one line per brand, change and UTC day: the same change seen on two viewports or several pages is one line, the earliest
 * sighting first, and when it was seen on more than one page the line ends with the pages ("home page, product page"). Pure; order kept.
 */
/** E3: a tape line's parts, for lists that set them apart (the front page's tape): brand name, what changed, when, its marks. */
export type TapeParts = { name: string; what: string; when: string; marks: string[] };
export function tapeRows<E extends TapeEvent>(events: E[], labels: (e: E) => TapeLabels = () => ({}), name?: (domain: string) => string | null | undefined): (E & { tape: string; also: number[]; pages: string[]; parts: TapeParts })[] {
  const key = (e: E) => `${e.domain}|${e.detected_at.slice(0, 10)}|${tapeWhat({ ...e, page_type: "home" })}`;
  const groups = new Map<string, E[]>();
  for (const e of events) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  const out: (E & { tape: string; also: number[]; pages: string[]; parts: TapeParts })[] = [];
  const done = new Set<string>();
  for (const e of events) {
    const k = key(e); if (done.has(k)) continue; done.add(k);
    const g = groups.get(k)!, first = [...g].sort((a, b) => a.detected_at.localeCompare(b.detected_at) || a.id - b.id)[0]!;
    const pages = [...new Set(g.map(x => pageName(x.page_type)))].sort((a, b) => (a === "home page" ? -1 : b === "home page" ? 1 : a.localeCompare(b)));
    const l = g.reduce<TapeLabels>((acc, x) => { const y = labels(x); return { seasonal: !!(acc.seasonal || y.seasonal), reversed: !!(acc.reversed || y.reversed), carousel: !!(acc.carousel || y.carousel) }; }, {});
    const base = pages.length > 1 ? { ...first, page_type: "home" } : first;
    const line = tapeLine(base, l, name?.(e.domain));
    const parts: TapeParts = { name: brandName(base.domain, name?.(e.domain)), what: `${tapeWhat(base)}${pages.length > 1 ? ` · ${pages.join(", ")}` : ""}`, when: changeWhen(base), marks: tapeLabels(l) };
    out.push({ ...e, tape: pages.length > 1 ? `${line} · ${pages.join(", ")}` : line, also: g.filter(x => x.id !== e.id).map(x => x.id), pages, parts });
  }
  return out;
}
