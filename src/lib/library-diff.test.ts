import { describe, expect, it } from "vitest";
import { deltaE76, diffLibrarySignals } from "./library-diff";

const ctx = { page_type: "home", viewport: "desktop" };
const base = { type: { rendered: { h1: { family: "Inter" }, body: { family: "Arial" } } }, color: { theme: "light", accent: "#FF0000" }, layout: { hero_media: "image", h1_align: "left", grid_max_cols: 3, cta_radius_px: 8, page_height_vh: 10 }, lexicon: { h1: "Tools for teams" }, tech: { next: false }, nav: [{ label: "Home", href: "/", depth: 0 }, { label: "Pricing", href: "/pricing", depth: 0 }] };
describe("library change rules", () => {
  it("creates no events for a no-op or first snapshot", () => { expect(diffLibrarySignals(base, base, ctx)).toEqual([]); expect(diffLibrarySignals(null, base, ctx)).toEqual([]); });
  it("theme flip is severity 2", () => { expect(diffLibrarySignals(base, { ...base, color: { ...base.color, theme: "dark" } }, ctx)).toEqual([{ type: "theme_flip", severity: 2, summary: "theme light → dark", before: { theme: "light" }, after: { theme: "dark" } }]); });
  it("one font change is severity 2", () => { expect(diffLibrarySignals(base, { ...base, type: { rendered: { ...base.type.rendered, h1: { family: "Söhne" } } } }, ctx).map(e => [e.type, e.severity])).toEqual([["type_change", 2]]); });
  it("both font changes are severity 3", () => { expect(diffLibrarySignals(base, { ...base, type: { rendered: { h1: { family: "Söhne" }, body: { family: "Roboto" } } } }, ctx).map(e => [e.type, e.severity])).toEqual([["type_change", 3]]); });
  it("redesign requires three distinct types on home desktop", () => {
    const two = { ...base, color: { ...base.color, theme: "dark" }, tech: { next: true } };
    expect(diffLibrarySignals(base, two, ctx).map(e => e.type)).toEqual(["theme_flip", "stack_change"]);
    const three = { ...two, lexicon: { h1: "Explore distant galaxies" } };
    expect(diffLibrarySignals(base, three, ctx).map(e => [e.type, e.severity])).toEqual([["theme_flip", 2], ["message_pivot", 2], ["stack_change", 2], ["redesign", 3]]);
    for (const context of [{ page_type: "home", viewport: "mobile" }, { page_type: "pricing", viewport: "desktop" }]) expect(diffLibrarySignals(base, three, context).some(e => e.type === "redesign")).toBe(false);
  });
  it("only a new page type creates new_surface severity 1", () => {
    expect(diffLibrarySignals(null, {}, { ...ctx, page_type: "pricing", new_surface: true, first_captured_at: "2026-11-10T00:00:00Z", captured_at: "2026-11-11T00:00:01Z" })).toEqual([{ type: "new_surface", severity: 1, summary: "pricing page added", before: {}, after: { page_type: "pricing" } }]);
    expect(diffLibrarySignals(null, {}, { ...ctx, new_surface: false })).toEqual([]);
  });
  it("suppresses new surfaces during the baseline and at exactly 24 hours", () => {
    for (const captured_at of ["2026-11-10T01:00:00Z", "2026-11-11T00:00:00Z"]) expect(diffLibrarySignals(null, {}, { ...ctx, new_surface: true, first_captured_at: "2026-11-10T00:00:00Z", captured_at })).toEqual([]);
  });
  it("accent shifts require CIE76 distance greater than 20", () => {
    expect(deltaE76("#000000", "#FFFFFF")).toBeCloseTo(100, 3);
    expect(diffLibrarySignals(base, { ...base, color: { ...base.color, accent: "#FE0000" } }, ctx)).toEqual([]);
    expect(diffLibrarySignals(base, { ...base, color: { ...base.color, accent: "#00FF00" } }, ctx).map(e => [e.type, e.severity])).toEqual([["palette_shift", 1]]);
  });
  it("three top-five palette replacements beyond distance 15 fire", () => {
    const old = { color: { palette: [{ hex: "#000000" }, { hex: "#111111" }] } };
    expect(diffLibrarySignals(old, { color: { palette: ["#FFFFFF", "#FF0000"] } }, ctx)).toEqual([]);
    expect(diffLibrarySignals(old, { color: { palette: ["#FFFFFF", "#FF0000", "#00FF00"] } }, ctx).map(e => e.type)).toEqual(["palette_shift"]);
  });
  it.each(["hero_media", "h1_align", "grid_max_cols", "cta_radius_px"])("layout %s change fires severity 1", key => {
    const values: Record<string, unknown> = { hero_media: "video", h1_align: "center", grid_max_cols: 4, cta_radius_px: 999 };
    expect(diffLibrarySignals(base, { ...base, layout: { ...base.layout, [key]: values[key] } }, ctx).map(e => [e.type, e.severity])).toEqual([["layout_change", 1]]);
  });
  it("CTA radii stay quiet within buckets", () => {
    for (const [before, after] of [[1, 8], [9, 24], [25, 999]]) expect(diffLibrarySignals({ layout: { cta_radius_px: before } }, { layout: { cta_radius_px: after } }, ctx)).toEqual([]);
  });
  it("height change must exceed 40 percent", () => {
    expect(diffLibrarySignals(base, { ...base, layout: { ...base.layout, page_height_vh: 14 } }, ctx)).toEqual([]);
    expect(diffLibrarySignals(base, { ...base, layout: { ...base.layout, page_height_vh: 14.1 } }, ctx).map(e => e.type)).toEqual(["layout_change"]);
  });
  it("nav compares top-level label sets at Jaccard below 0.6", () => {
    const nav = (labels: string[]) => labels.map(label => ({ label, href: "/", depth: 0 }));
    expect(diffLibrarySignals({ nav: nav(["a", "b", "c"]) }, { nav: nav(["a", "b", "c", "d", "e"]) }, ctx)).toEqual([]);
    expect(diffLibrarySignals({ nav: nav(["a", "b", "c"]) }, { nav: nav(["a", "b", "d"]) }, ctx).map(e => [e.type, e.severity])).toEqual([["nav_change", 1]]);
    expect(diffLibrarySignals(base, { ...base, nav: [...base.nav, { label: "Other", href: "/other", depth: 1 }] }, ctx)).toEqual([]);
  });
  it("headline word overlap must be below 0.3", () => {
    expect(diffLibrarySignals({ lexicon: { h1: "a b c" } }, { lexicon: { h1: "a b c d e f g h i j" } }, ctx)).toEqual([]);
    expect(diffLibrarySignals(base, { ...base, lexicon: { h1: "Explore distant galaxies" } }, ctx).map(e => [e.type, e.severity])).toEqual([["message_pivot", 2]]);
  });
  it("pricing hashes create severity 2 only on pricing", () => {
    const hashContext = { ...ctx, prev_content_hash: "a", content_hash: "b" };
    expect(diffLibrarySignals(base, base, hashContext)).toEqual([]);
    expect(diffLibrarySignals(base, base, { ...hashContext, page_type: "pricing" }).map(e => [e.type, e.severity, e.summary])).toEqual([["pricing_change", 2, "pricing page content changed"]]);
  });
  it.each(["next", "nuxt", "framer", "webflow", "wordpress", "shopify", "squarespace", "wix", "astro", "gatsby", "sveltekit"])("%s framework flag flip is severity 2", key => {
    expect(diffLibrarySignals({ tech: { [key]: false } }, { tech: { [key]: true } }, ctx).map(e => [e.type, e.severity])).toEqual([["stack_change", 2]]);
  });
  it("ignores pure count noise", () => { expect(diffLibrarySignals(base, { ...base, layout: { ...base.layout, cta_count: 99, nav_links: 80 }, composition: { text_chars: 10000 } }, ctx)).toEqual([]); });
});