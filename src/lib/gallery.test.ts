import { describe, expect, it } from "vitest";
import { GALLERY_PAGE, LARGE_EVERY, NO_FILTER, TILE_BOXES, countLine, galleryModel, galleryQuery, gallerySearch, parseGallerySearch, tileFrame, tileLabel, type GalleryIn } from "./gallery";
import type { CropRow } from "./crops";
import type { Box, Frame } from "./data-stories/types";

const NOW = Date.parse("2026-11-20T00:00:00Z");
const sites = [{ domain: "neon.com", name: "Neon", sector: "dev-tools" }, { domain: "ramp.com", name: "Ramp", sector: "fintech" }, { domain: "stripe.com", name: "Stripe", sector: "fintech" }];
const P = [{ key: "combo:big_type", name: "Big type", basis: "measured" as const }, { key: "combo:soft_ui", name: "Soft UI", basis: "ai" as const }, { key: "combo:rare", name: "Rare", basis: "measured" as const }];
let id = 0;
const cap = (domain: string, at: string, quarter: string, traits: string[]) => ({ id: ++id, domain, at, quarter, source: "live" as const, traits });
const crop = (domain: string, section: string, at: string): CropRow => ({ domain, section, viewport: "desktop", captured_at: at, first_seen_at: at, last_seen_at: at, path: `${domain}/${section}.webp`, width: 1280, height: 800, bytes: 9000, hash: "h" });
function input(over: Partial<GalleryIn> = {}): GalleryIn {
  id = 0;
  const captures = [
    cap("neon.com", "2026-11-16T00:00:00Z", "2026Q4", ["combo:big_type", "combo:soft_ui"]), cap("ramp.com", "2026-11-15T00:00:00Z", "2026Q4", ["combo:big_type"]),
    cap("stripe.com", "2026-11-14T00:00:00Z", "2026Q4", ["combo:big_type", "combo:rare"]), cap("neon.com", "2026-08-01T00:00:00Z", "2026Q3", ["combo:soft_ui"]),
    cap("ramp.com", "2026-08-02T00:00:00Z", "2026Q3", ["combo:soft_ui"]), cap("stripe.com", "2021-02-01T00:00:00Z", "2021Q1", ["combo:big_type"]),
  ];
  return { now: NOW, sites, captures, changes: [], stamps: captures.map(c => ({ id: c.id, domain: c.domain, at: c.at, source: c.source })), patterns: P, keys: [], crops: [], ...over };
}

describe("gallery model", () => {
  it("unfiltered: every capture showing a walled pattern, newest first, with a count line", () => {
    const m = galleryModel(input(), NO_FILTER);
    expect(m.total).toBe(6);
    expect(m.tiles.map(t => t.domain)).toEqual(["neon.com", "ramp.com", "stripe.com", "ramp.com", "neon.com", "stripe.com"]);
    expect(m.countLine).toBe("6 of 6 captures");
    expect(m.tiles[0]!.label).toBe("neon.com, first screen, 16 Nov 2026");
    expect(m.tiles[0]!.href).toBe("/brands/neon.com");
  });
  it("the illustrated rule: a pattern with fewer than three captures has no wall", () => {
    const m = galleryModel(input(), { ...NO_FILTER, pattern: "combo:rare" });
    expect(m.options.patterns.map(p => p.key)).toEqual(["combo:big_type", "combo:soft_ui"]);
    expect(m.pattern!.walled).toBe(false);
    expect(m.total).toBe(0);
    expect(m.countLine).toBe("0 captures");
  });
  it("filters: pattern, sector, period, latest, since, basis", () => {
    const i = input();
    expect(galleryModel(i, { ...NO_FILTER, pattern: "combo:big_type" }).total).toBe(4);
    expect(galleryModel(i, { ...NO_FILTER, sectors: ["fintech"] }).tiles.map(t => t.domain)).toEqual(["ramp.com", "stripe.com", "ramp.com", "stripe.com"]);
    expect(galleryModel(i, { ...NO_FILTER, period: "2026Q3" }).total).toBe(2);
    expect(galleryModel(i, { ...NO_FILTER, period: "latest" }).period).toBe("2026Q4");
    expect(galleryModel(i, { ...NO_FILTER, since: "2026Q3" }).total).toBe(5);
    expect(galleryModel(i, { ...NO_FILTER, basis: "ai" }).total).toBe(3);
    expect(galleryModel(i, { ...NO_FILTER, pattern: "combo:big_type", basis: "ai" }).total).toBe(0);
  });
  it("the section filter is offered only when crops exist for it, and is dropped otherwise", () => {
    expect(galleryModel(input(), { ...NO_FILTER, section: "pricing" }).options.sections).toEqual([]);
    expect(galleryModel(input(), { ...NO_FILTER, section: "pricing" }).filter.section).toBeNull();
    const withCrop = input({ crops: [crop("neon.com", "pricing", "2026-11-16T06:00:00Z")] });
    const m = galleryModel(withCrop, { ...NO_FILTER, section: "pricing" });
    expect(m.options.sections).toEqual(["pricing"]);
    expect(m.tiles.map(t => t.domain)).toEqual(["neon.com"]);
    expect(m.tiles[0]!.label).toBe("neon.com, pricing, 16 Nov 2026");
  });
  it("a stored crop is preferred over the redrawn frame", () => {
    const m = galleryModel(input({ crops: [crop("neon.com", "hero", "2026-11-17T00:00:00Z")] }), NO_FILTER);
    expect(m.tiles[0]!.crop).not.toBeNull();
    expect(m.tiles[1]!.crop).toBeNull();
  });
  it("paging: 48 a page, later pages count from where they start, sizes are deterministic", () => {
    const many = Array.from({ length: 100 }, (_, k) => ({ id: 1000 + k, domain: sites[k % 3]!.domain, at: new Date(NOW - k * 864e5).toISOString(), quarter: "2026Q4", source: "live" as const, traits: ["combo:big_type"] }));
    const i = input({ captures: many });
    const p1 = galleryModel(i, NO_FILTER), p2 = galleryModel(i, { ...NO_FILTER, page: 2 }), p9 = galleryModel(i, { ...NO_FILTER, page: 9 });
    expect(GALLERY_PAGE).toBe(48);
    expect(p1.tiles).toHaveLength(48); expect(p1.countLine).toBe("48 of 100 captures");
    expect(p2.countLine).toBe("49–96 of 100 captures");
    expect(p9.page).toBe(3); expect(p9.tiles).toHaveLength(4);
    // S1 · no stored pictures here, so no tile is large (stand-ins only ever take small tiles).
    expect(p1.tiles.filter(t => t.size === "lg")).toHaveLength(0);
    const withCrops = galleryModel(input({ captures: many, crops: many.map(c => crop(c.domain, "hero", c.at)) }), NO_FILTER);
    expect(withCrops.tiles.filter(t => t.size === "lg")).toHaveLength(Math.ceil(48 / LARGE_EVERY));
  });
  it("S1 · stored captures come before stand-ins, a large tile is always a stored capture, and a stand-in never opens the wall", () => {
    // Every third capture has its stored picture; the rest would be drawn stand-ins.
    const many = Array.from({ length: 60 }, (_, k) => ({ id: 3000 + k, domain: sites[k % 3]!.domain, at: new Date(NOW - k * 864e5).toISOString(), quarter: "2026Q4", source: "live" as const, traits: ["combo:big_type"] }));
    const crops = many.filter((_, k) => k % 3 === 0).map(c => crop(c.domain, "hero", c.at));
    const m = galleryModel(input({ captures: many, crops }), NO_FILTER);
    const withPic = m.tiles.findIndex(t => !t.crop);
    expect(withPic).toBe(20);
    expect(m.tiles.slice(0, 20).every(t => t.crop)).toBe(true);
    expect(m.tiles.filter(t => t.size === "lg").every(t => t.crop)).toBe(true);
    // Within each group the wall is still newest first.
    const days = m.tiles.slice(0, 20).map(t => t.at);
    expect([...days].sort().reverse()).toEqual(days);
    // The first screen (first twelve tiles) holds no more than one stand-in in six.
    expect(m.tiles.slice(0, 12).filter(t => !t.crop).length).toBeLessThanOrEqual(2);
  });
  it("no-JavaScript paged links carry the whole filter", () => {
    const many = Array.from({ length: 60 }, (_, k) => ({ id: 2000 + k, domain: "ramp.com", at: new Date(NOW - k * 864e5).toISOString(), quarter: "2026Q4", source: "live" as const, traits: ["combo:big_type"] }));
    const m = galleryModel(input({ captures: many }), { ...NO_FILTER, sectors: ["fintech"], pattern: "combo:big_type" });
    expect(m.prev).toBeNull();
    expect(m.next).toBe("?sector=fintech&pattern=combo%3Abig_type&page=2");
    expect(galleryModel(input({ captures: many }), { ...NO_FILTER, sectors: ["fintech"], page: 2 }).prev).toBe("?sector=fintech");
  });
  it("changed mode: the captures either side of each recent change, labelled", () => {
    const i = input();
    i.changes = [{ domain: "neon.com", at: "2026-11-16T00:00:00Z", type: "font_change", before: 4, after: 1 }, { domain: "ramp.com", at: "2025-01-01T00:00:00Z", type: "font_change", before: 5, after: 2 }];
    const m = galleryModel(i, { ...NO_FILTER, changed: 30 });
    expect(m.tiles.map(t => [t.snapshot, t.note?.split(" · ")[0]])).toEqual([[4, "Before"], [1, "After"]]);
  });
  it("URL round trip keeps only non-defaults; unknown values fall back", () => {
    const f = parseGallerySearch({ sector: "fintech", pattern: "combo:big_type", period: "2026Q4", basis: "ai", section: "hero", page: 3 });
    expect(gallerySearch(f)).toEqual({ sector: "fintech", pattern: "combo:big_type", period: "2026Q4", basis: "ai", section: "hero", page: 3 });
    expect(parseGallerySearch(gallerySearch(f) as Record<string, unknown>)).toEqual(f);
    expect(parseGallerySearch({ period: "Q9", basis: "guess", section: "sidebar", page: -4, sector: "nowhere" })).toEqual(NO_FILTER);
    expect(galleryQuery(NO_FILTER)).toBe("");
    expect(countLine(0, 0, 0)).toBe("0 captures");
    expect(tileLabel("neon.com", "2026-11-16T00:00:00Z", "cta")).toBe("neon.com, call to action, 16 Nov 2026");
  });
  it("a tile redraws at most 40 boxes (trimmed from 60 in Phase 21 for the HTML budget), first screen only", () => {
    const boxes: Box[] = Array.from({ length: 200 }, (_, k) => ["t", 0, k * 10, 100, 20 + (k % 5)]);
    const fr: Frame = { id: "1", at: "2026-11-16", source: "live", w: 1280, h: 4000, bg: null, ink: null, accent: null, tones: [], boxes, crop: null, archiveUrl: null };
    const t = tileFrame(fr);
    expect(TILE_BOXES).toBe(32);
    expect(t.boxes.length).toBeLessThanOrEqual(40);
    expect(t.h).toBe(900);
    expect(t.boxes.every(b => b[2] < 900 && b[2] + b[4] <= 900)).toBe(true);
  });
});
