// Designer’s kit: text payloads only, built from stored identity and structure fields.
import type { BrandCard, Face } from "./brand-page";
import { ROLE_NAME, stripExtent, type StructureRecord } from "./structure";
import { tableCsv } from "./views/receipts";
export type KitBrand = Pick<BrandCard, "name" | "domain" | "captured" | "identity">;
export function captureDate(iso: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return "date not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
}
const comment = (s: string) => s.replace(/\*\//g, "* /").replace(/[\r\n]/g, " ");
const quote = (s: string) => JSON.stringify(s.replace(/[\r\n]/g, " "));
const colors = (b: KitBrand) => b.identity.palette.filter(p => /^#[0-9a-f]{3,8}$/i.test(p.hex));
export const paletteHex = (b: KitBrand) => colors(b).map(p => p.hex).join("\n");
export const paletteCss = (b: KitBrand) => `/* ${comment(b.name)} · ${captureDate(b.captured)} */\n:root {\n${colors(b).map((p, i) => `  --brand-${i + 1}: ${p.hex};`).join("\n")}\n}`;
export const paletteTokens = (b: KitBrand) => JSON.stringify({ name: b.name, captured: b.captured, colors: colors(b).map((p, i) => ({ name: `brand-${i + 1}`, value: p.hex, share: p.share })) }, null, 2);
const fallback = (family: string) => /mono|courier/i.test(family) ? "monospace" : /serif|georgia|times/i.test(family) && !/sans/i.test(family) ? "serif" : "sans-serif";
const fontRule = (selector: string, f: Face | null) => f ? `${selector} {\n  font-family: ${quote(f.family)}, ${fallback(f.family)};${f.size != null ? `\n  font-size: ${f.size}px;` : ""}\n}` : `/* ${selector}: not measured */`;
export const typeCss = (b: KitBrand) => `/* ${comment(b.name)} · ${captureDate(b.captured)} */\n${fontRule("h1", b.identity.h1)}\n${fontRule("body", b.identity.body)}`;
export const typeText = (b: KitBrand) => ([['Headline', b.identity.h1], ['Body', b.identity.body]] as const).map(([name, f]) => `${name}: ${f ? `${f.family}${f.size != null ? ` ${f.size}px` : ""}` : "not measured"}`).join(" · ");
export const sectionText = (r: StructureRecord | null) => r?.sections ? [...r.sections.map(s => ROLE_NAME[s.r] ?? s.r), ...(stripExtent(r).more ? [`+${stripExtent(r).more} more sections`] : [])].join(" → ") : "Section order not read";
export const asksText = (r: StructureRecord | null) => r?.asks ? r.asks.map(a => `${a.l}${a.p ? " (primary)" : ""}`).join(" · ") || "No first-screen asks" : "First-screen asks not read";
export const citation = (b: KitBrand) => `${b.name} homepage, as read by slug on ${captureDate(b.captured)} · slug.global/brands/${b.domain}`;
export const googleFontUrl = (f: Face | null) => f?.google ? `https://fonts.google.com/specimen/${encodeURIComponent(f.family).replace(/%20/g, "+")}` : null;
export type ExportBrand = { name: string; domain: string; sector: string | null; category: string | null; subcategory: string | null; headline: string | null; body: string | null; theme: string | null; accent: string | null; ask: string | null };
export const brandCsv = (brands: readonly ExportBrand[]) => tableCsv({ head: ["Name", "Domain", "Sector", "Category", "Sub-category", "Headline family", "Body family", "Theme", "Accent", "Primary ask"], rows: brands.map(b => [b.name, b.domain, b.sector ?? "", b.category ?? "", b.subcategory ?? "", b.headline ?? "", b.body ?? "", b.theme ?? "", b.accent ?? "", b.ask ?? ""]) });