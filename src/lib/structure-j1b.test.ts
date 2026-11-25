import { describe, it, expect } from "vitest";
import { deriveRecord, flagsOf, stripExtent, NAV_BUTTON_JOIN } from "./structure";
const base = { id: 1, domain: "example.com", viewport: "desktop", source: "live", captured_at: "2026-11-25T00:00:00Z", nav: [{ label: "Pricing", depth: 1, visible: true }] };
describe("J1b stored structure", () => {
  it("unites links and menu buttons, normalising and deduplicating", () => {
    const record = deriveRecord({ ...base, structure: { v: 1, furniture: { nav_buttons: ["Products", "Solutions", "Pricing", "Products"] } } });
    expect(record.nav_labels).toEqual(["pricing", "products", "solutions"]);
    expect(flagsOf(record, "desktop")["nav:says_solutions"]).toBe(true);
  });
  it("does not add button readings to historical captures", () => {
    expect(deriveRecord(base).nav_labels).toBeNull();
  });
  it("marks the new reading in Q4 2026", () => { expect(NAV_BUTTON_JOIN.quarter).toBe("2026Q4"); });
  it("stores the true section count and stops the strip at section sixteen", () => {
    const sections = Array.from({ length: 16 }, (_, i) => ({ r: "cards", y: i * 100, h: 100 }));
    const record = deriveRecord({ ...base, page: { h: 2800 }, structure: { v: 1, n_sections: 28, sections } });
    expect(record.n_sections).toBe(28);
    expect(stripExtent(record)).toEqual({ more: 12, total: 1600 });
  });
  it("keeps the full extent for a complete list", () => {
    expect(stripExtent({ sections: [{ r: "hero", y: 0, h: 600, t: null }], n_sections: 1, page_h: 900 })).toEqual({ more: 0, total: 900 });
  });
});