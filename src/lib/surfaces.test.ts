import { describe, expect, it } from "vitest";
import { fieldMatch, fieldText, productLine, productPair, productTypeCount, surfaceMatch, type SurfaceCapture } from "./surfaces";

const cap = (o: Partial<SurfaceCapture>): SurfaceCapture => ({ id: 1, domain: "x.com", page_type: "home", captured_at: "2026-11-21T06:00:00Z", run_id: "r1", url: null, h1: { family: "Canela" }, body: { family: "Inter" }, theme: "light", accent: "#AF5A3C", ...o });
const day = (iso: string) => iso.slice(0, 10);

describe("W1b · surfaces against the homepage", () => {
  it("matches typefaces by the library's font rule and accents by colour distance", () => {
    const home = cap({}), p = cap({ page_type: "product", h1: { family: "CanelaWebfont" }, accent: "#B05B3D" });
    expect(fieldMatch(home, p, "h1")).toBe("yes"); expect(fieldMatch(home, p, "accent")).toBe("yes"); expect(surfaceMatch(home, p)).toBe("yes");
    expect(fieldMatch(home, cap({ h1: { family: "Inter" } }), "h1")).toBe("no");
  });
  it("a missing field or a fallback font is not comparable, never a difference", () => {
    expect(fieldMatch(cap({}), cap({ h1: null }), "h1")).toBe("not comparable");
    expect(fieldMatch(cap({}), cap({ h1: { family: "Arial", substituted: true } }), "h1")).toBe("not comparable");
    expect(fieldText(cap({ h1: { family: "Arial", substituted: true } }), "h1")).toBe("fallback font");
    expect(surfaceMatch(cap({}), cap({ h1: null, body: null, theme: null, accent: null }))).toBe("not comparable");
  });
  it("compares only a home and product capture from the same crawl, and never a gift-card page", () => {
    const caps = [cap({ id: 1 }), cap({ id: 2, page_type: "product", run_id: "r0", h1: { family: "Inter" } }), cap({ id: 3, run_id: "r0", captured_at: "2026-11-20T06:00:00Z" })];
    expect(productPair(caps)?.home.id).toBe(3);
    expect(productPair([cap({}), cap({ id: 2, page_type: "product", url: "https://x.com/products/gift-card" })])).toBeNull();
    expect(productPair([cap({}), cap({ id: 2, page_type: "product", run_id: "r9" })])).toBeNull();
  });
  it("counts brands whose product page uses a different headline typeface among those comparable", () => {
    const pair = (d: string, h: string | null) => productPair([cap({ domain: d }), cap({ domain: d, id: 2, page_type: "product", h1: h ? { family: h } : null })])!;
    const r = productTypeCount([pair("a.com", "Inter"), pair("b.com", "Canela"), pair("c.com", null)]);
    expect([r.differ.map(p => p.domain), r.base]).toEqual([["a.com"], 2]);
  });
  it("the brand page line says what matched, in plain words", () => {
    const p = productPair([cap({}), cap({ id: 2, page_type: "product", accent: "#0601FF" })]);
    expect(productLine(p, day)).toBe("The product page uses the homepage's headline typeface and a different accent colour (both captured in the same crawl on 2026-11-21).");
  });
});

import { matchLine, type SurfaceListRow } from "./surfaces";
describe("W1c · the one line above the Surfaces list", () => {
  const row = (key: string, match: SurfaceListRow["match"]) => ({ key, match }) as SurfaceListRow;
  it("counts the other pages that match the homepage, in plain words", () => {
    expect(matchLine([row("home", "this is home"), row("product", "yes"), row("about", "no")])).toBe("1 of the 2 other pages we read matches the homepage.");
    expect(matchLine([row("home", "this is home"), row("product", "yes"), row("about", "yes")])).toBe("Both other pages we read match the homepage.");
    expect(matchLine([row("home", "this is home"), row("product", "no"), row("about", "not comparable")])).toBe("None of the 2 other pages we read matches the homepage; 1 could not be compared.");
    expect(matchLine([row("home", "this is home"), row("pricing", "no")])).toBe("The one other page we read does not match the homepage.");
    expect(matchLine([row("home", "this is home")])).toBeNull();
  });
});
