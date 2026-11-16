// Caption builders. Every sentence is a template filled from numbers; numbers and names are segments with receipts. Pure.
import type { Caption, Num, Ref, Seg } from "./types";

export const num = (n: string, v: number, href: string): Num => ({ n, v, href });
export const ref = (r: string, href: string): Ref => ({ r, href });
export const isNum = (s: Seg): s is Num => typeof s === "object" && "n" in s;
export const isRef = (s: Seg): s is Ref => typeof s === "object" && "r" in s;
/** Plain text of a caption (for the live region, print, MCP and share images). */
export const capText = (c: Caption) => c.map(s => (typeof s === "string" ? s : isNum(s) ? s.n : s.r)).join("");
/** Tagged template: `cap\`${num(...)} brands\`` → segments. Interpolations must be segments; literal text must not contain digits. */
export function cap(strings: TemplateStringsArray, ...parts: Seg[]): Caption {
  const out: Caption = [];
  strings.forEach((s, i) => { if (s) out.push(s); const p = parts[i]; if (p !== undefined && p !== "") out.push(p); });
  return out;
}
/** "a, b and c" over segments. */
export function list(items: Seg[]): Seg[] {
  if (items.length <= 1) return items;
  return items.flatMap((x, i) => (i === 0 ? [x] : i === items.length - 1 ? [" and ", x] : [", ", x]));
}
export const capList = (before: string, items: Seg[], after = ""): Caption => [before, ...list(items), ...(after ? [after] : [])];

// Number formats --------------------------------------------------------------------------------------
export const pctText = (v: number) => `${(v * 100).toFixed(1)}%`;
export const ptsText = (d: number) => `${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)} points`;
export const qText = (q: string) => { const m = /^(\d{4})Q([1-4])$/.exec(q); return m ? `Q${m[2]} ${m[1]}` : q; };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dayText = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const yearOf = (q: string) => Number(q.slice(0, 4));

// Receipts ------------------------------------------------------------------------------------------
export const signalHref = (key: string) => `/signals/${encodeURIComponent(key)}`;
export const brandHref = (domain: string) => `/brands/${encodeURIComponent(domain)}`;
export const sectorHref = (sector: string) => `/sectors/${sector}`;
export const HISTORY_HREF = "/terminal?panel=history";
export const RULE_HREF = "/what-we-show";
