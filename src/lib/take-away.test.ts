import { describe, it, expect } from "vitest";
import { paletteHex, paletteCss, paletteTokens, typeCss, typeText, citation, googleFontUrl, sectionText, brandCsv, type KitBrand } from "./take-away";
const brand: KitBrand = { name: "Stripe", domain: "stripe.com", captured: "2026-11-25T00:00:00Z", identity: { h1: { family: "Systemia", size: 80, google: false, css: null }, body: { family: "Systemia", size: 14, google: false, css: null }, palette: [{ hex: "#ffffff", name: "White", share: .8 }, { hex: "#000000", name: "Black", share: .2 }], tags: [], layout: [], accent: null, theme: "light", receipt: "" } };
describe("F1 copied payloads", () => {
  it("copies only stored hex values", () => expect(paletteHex(brand)).toBe("#ffffff\n#000000"));
  it("names the brand and date in palette CSS", () => expect(paletteCss(brand)).toBe("/* Stripe · 25 Nov 2026 */\n:root {\n  --brand-1: #ffffff;\n  --brand-2: #000000;\n}"));
  it("keeps measured colour shares in tokens JSON", () => expect(JSON.parse(paletteTokens(brand)).colors).toEqual([{ name: "brand-1", value: "#ffffff", share: .8 }, { name: "brand-2", value: "#000000", share: .2 }]));
  it("copies stored families and sizes with a fallback", () => { expect(typeCss(brand)).toContain('h1 {\n  font-family: "Systemia", sans-serif;\n  font-size: 80px;'); expect(typeCss(brand)).toContain('font-size: 14px;'); });
  it("copies the requested plain type line", () => expect(typeText(brand)).toBe("Headline: Systemia 80px · Body: Systemia 14px"));
  it("copies a dated brand citation", () => expect(citation(brand)).toBe("Stripe homepage, as read by slug on 25 Nov 2026 · slug.global/brands/stripe.com"));
  it("does not guess a font supplier", () => { expect(googleFontUrl(brand.identity.h1)).toBeNull(); expect(googleFontUrl({ family: "IBM Plex Sans", google: true, size: null, css: null })).toBe("https://fonts.google.com/specimen/IBM+Plex+Sans"); });
  it("does not invent a missing structure", () => expect(sectionText(null)).toBe("Section order not read"));
  it("uses the existing formula-safe CSV helper", () => expect(brandCsv([{ name: '=HYPERLINK("bad")', domain: "example.com", sector: null, category: null, subcategory: null, headline: null, body: null, theme: null, accent: null, ask: null }])).toContain('"\'=HYPERLINK(""bad"")"'));
});