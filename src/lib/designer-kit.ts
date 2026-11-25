import type { BrandCard } from "./brand-page";
import { currentCrop, toCrop, type CropRow, type CropSection } from "./crops";
import { label } from "./labels";
import { STRUCTURE_BY_KEY, type StructureRecord } from "./structure";
import type { ExportBrand } from "./take-away";
export type KitRecord = ExportBrand & { captured: string | null; identity: BrandCard["identity"]; traits: string[]; firstSeen: Record<string, string>; structure: StructureRecord | null; phone: StructureRecord | null; lastChange: { text: string; at: string } | null; collections: string[] };
export type BoardFilters = { sector?: string | undefined; category?: string | undefined; sub?: string | undefined; since?: string | undefined; view?: string | undefined; sort?: string | undefined; dir?: string | undefined };
export function boardSearch(s: Record<string, unknown>): BoardFilters {
  return Object.fromEntries(["sector", "category", "sub", "since", "view", "sort", "dir"].flatMap(k => typeof s[k] === "string" ? [[k, s[k]]] : []));
}
export function boardMembers(rows: readonly KitRecord[], key: string, f: BoardFilters = {}) {
  return rows.filter(r => r.traits.includes(key) && (!f.sector || r.sector === f.sector) && (!f.category || r.category === f.category) && (!f.sub || r.subcategory === f.sub) && (!f.since || (r.firstSeen[key] ?? "") >= f.since)).sort((a, b) => (b.firstSeen[key] ?? "").localeCompare(a.firstSeen[key] ?? "") || a.name.localeCompare(b.name));
}
export const boardDimension = (key: string) => STRUCTURE_BY_KEY.has(key) ? "Structure" : /^(tone|h1_word|ai_positioning):/.test(key) ? "Voice" : ({ FONT: "Type", COLOR: "Color", LAYOUT: "Layout", VIBE: "Vibe" }[label(key).dimension] ?? "Layout");
export const boardName = (key: string) => STRUCTURE_BY_KEY.get(key)?.name ?? label(key).name;
export function boardIndex(rows: readonly KitRecord[]) {
  const keys = [...new Set(rows.flatMap(r => r.traits))];
  return keys.map(key => { const members = boardMembers(rows, key); return { key, name: boardName(key), dimension: boardDimension(key), count: members.length, recent: members.slice(0, 3).map(r => ({ domain: r.domain, name: r.name })) }; }).filter(r => r.count >= 15).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
export const boardCropSection = (key: string): CropSection => key.startsWith("nav:") || key.startsWith("furn:") ? "nav" : key === "page:has_pricing_section" ? "pricing" : key.startsWith("ask:") ? "cta" : "hero";
export function boardCrop(rows: CropRow[], r: KitRecord, key: string, optedOut = false) {
  if (optedOut) return null;
  const c = currentCrop(rows, r.domain, boardCropSection(key), r.captured);
  return c ? toCrop(c) : null;
}
export function compareDomains(s: Record<string, unknown>): string[] {
  return [...new Set([s["a"], s["b"], s["c"]].filter((d): d is string => typeof d === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)).map(d => d.toLowerCase()))].slice(0, 3);
}
export function chooseCompare(current: readonly string[], domain: string): string[] {
  return current.includes(domain) ? current.filter(d => d !== domain) : current.length < 3 ? [...current, domain] : [...current];
}
export const sameValues = (values: readonly unknown[]) => values.length > 1 && values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
export function commonKit(rows: readonly KitRecord[]) {
  const count = (values: string[][]) => { const m = new Map<string, number>(); for (const v of values) for (const s of new Set(v)) m.set(s, (m.get(s) ?? 0) + 1); return [...m].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 8); };
  return { colors: count(rows.map(r => r.identity.palette.map(p => p.hex))), fonts: count(rows.map(r => [r.headline, r.body].filter((s): s is string => !!s))) };
}