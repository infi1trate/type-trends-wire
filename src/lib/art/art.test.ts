// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chromatic, comparable, distance, groupOf, groups, nearestFor, nearestForSector, readyToShow, spread, varied, NEAR_DISTANCE, GROUP_MIN_WORKS, SHOW_MIN_WORKS, type Work } from "./palette";
import { artPayload, checkWork, linkOk, nearestLine, artPath, isArtPath } from "./contract";
import { handleArtIngest, removeArtWork, serveArt, type ArtStore, type StoredWork } from "./ingest.server";
import fixture from "./__fixtures__/dry-run-works.json";
import { b64, webp } from "../__fixtures__/webp";

/** Three colour families (light blue, light orange, dark green): varied. OTHER and THIRD are varied too, in other families. */
const THREE = [{ hex: "#1F5FFF", share: 0.4 }, { hex: "#FF5A1F", share: 0.35 }, { hex: "#2E7D32", share: 0.25 }];
const OTHER = [{ hex: "#8E24AA", share: 0.4 }, { hex: "#FFD400", share: 0.35 }, { hex: "#00A3A3", share: 0.25 }];
const THIRD = [{ hex: "#C2185B", share: 0.4 }, { hex: "#5D4037", share: 0.35 }, { hex: "#9CCC65", share: 0.25 }];
const FOURTH = [{ hex: "#4A148C", share: 0.4 }, { hex: "#F06292", share: 0.35 }, { hex: "#004D40", share: 0.25 }];
const work = (id: string, palette: { hex: string; share: number }[], o: Partial<Work> = {}): Work => ({ source: "aic", source_id: id, title: `Work ${id}`, artist: "A. Painter", date_display: "1880", year_start: 1880, tradition: "European paintings", movement: null, palette, ...o });

describe("nearest palette", () => {
  it("sets near-neutrals aside: a white page and a white wall are not a match", () => {
    expect(chromatic([{ hex: "#FFFFFF", share: 0.8 }, { hex: "#F4F1EA", share: 0.15 }, { hex: "#111111", share: 0.05 }])).toMatchObject({ ok: false, reason: "mostly neutral" });
    const kept = chromatic([{ hex: "#FFFFFF", share: 0.6 }, { hex: "#1F5FFF", share: 0.3 }, { hex: "#FF5A1F", share: 0.1 }]);
    expect(kept.ok && kept.colours.map(c => c.hex)).toEqual(["#1F5FFF", "#FF5A1F"]);
    expect(kept.ok && kept.colours.reduce((a, c) => a + c.w, 0)).toBeCloseTo(1, 9);
  });
  it("a brand with one colour left after neutrals is mostly neutral", () => {
    expect(nearestFor("x.com", [{ hex: "#FFFFFF", share: 0.9 }, { hex: "#1F5FFF", share: 0.1 }], [], [])).toEqual({ domain: "x.com", neutral: true, reason: "mostly neutral", colourShare: 0.1 });
  });
  it("distance is 0 for identical palettes, symmetric, and weighted by share", () => {
    const a = chromatic([{ hex: "#1F5FFF", share: 0.7 }, { hex: "#FF5A1F", share: 0.3 }]), b = chromatic([{ hex: "#1F5FFF", share: 0.3 }, { hex: "#FF5A1F", share: 0.7 }]), c = chromatic([{ hex: "#2A63F5", share: 0.7 }, { hex: "#F25A2A", share: 0.3 }]);
    if (!a.ok || !b.ok || !c.ok) throw new Error("fixture");
    expect(distance(a.colours, a.colours)).toBe(0);
    expect(distance(a.colours, b.colours)).toBe(distance(b.colours, a.colours));
    expect(distance(a.colours, c.colours)).toBe(distance(c.colours, a.colours));
    // Same two colours in other proportions are further apart than the same proportions in nearly the same colours.
    expect(distance(a.colours, b.colours)).toBeGreaterThan(distance(a.colours, c.colours));
  });
  it("groups: a movement where given, else tradition and half-century, read only with 15 works", () => {
    expect(groupOf({ movement: "Japanese (culture or style)", tradition: "Asian Art", year_start: 1820, source: "aic" }).name).toBe("Japanese (culture or style), as the Art Institute of Chicago labels it");
    expect(groupOf({ movement: null, tradition: "European paintings", year_start: 1863 }).name).toBe("European paintings, 1850 to 1899");
    const ws = Array.from({ length: GROUP_MIN_WORKS - 1 }, (_, i) => work(String(i), THREE));
    expect(groups(ws)).toEqual([]);
    const g = groups([...ws, work("x", [{ hex: "#8E24AA", share: 0.4 }, { hex: "#FF5A1F", share: 0.35 }, { hex: "#2E7D32", share: 0.25 }])]);
    expect(g).toHaveLength(1);
    // Built from all its works, not from one: violet from one work of fifteen is in the pool at a fifteenth of 0.4.
    const violet = g[0]!.colours.find(c => c.hex === "#8E24AA");
    expect(violet?.w).toBeCloseTo(0.4 / 15, 6);
  });
  it("a nearest work is kept only under the near threshold", () => {
    const brand = THREE;
    const close = nearestFor("b.com", brand, [work("1", [{ hex: "#2160FA", share: 0.4 }, { hex: "#FA5C22", share: 0.35 }, { hex: "#307F34", share: 0.25 }])], []);
    const far = nearestFor("b.com", brand, [work("2", [{ hex: "#8E24AA", share: 0.4 }, { hex: "#FFD400", share: 0.35 }, { hex: "#00A3A3", share: 0.25 }])], []);
    expect(!close.neutral && close.work?.near).toBe(true);
    expect(!far.neutral && far.work?.near).toBe(false);
    expect(!far.neutral && far.work!.distance).toBeGreaterThan(NEAR_DISTANCE);
  });
  // W3b · one test per rule, with the brief's numbers.
  it("a palette is varied only when no colour family holds over 60% and three hold 5% or more (paper and varnish are not a palette)", () => {
    const pal = (xs: [string, number][]) => xs.map(([hex, share]) => ({ hex, share }));
    expect(comparable(pal([["#1F5FFF", 0.6], ["#FF5A1F", 0.35], ["#2E7D32", 0.05]])).ok).toBe(true);
    expect(comparable(pal([["#1F5FFF", 0.61], ["#FF5A1F", 0.34], ["#2E7D32", 0.05]]))).toMatchObject({ ok: false, reason: "not varied" });
    expect(comparable(pal([["#1F5FFF", 0.5], ["#FF5A1F", 0.46], ["#2E7D32", 0.04]]))).toMatchObject({ ok: false, reason: "not varied" });
    // Three shades of one beige are one colour, as the strip draws it: a print that is its paper is not compared.
    expect(comparable(pal([["#E8D3B0", 0.5], ["#D9C29C", 0.3], ["#CDB48A", 0.15], ["#1F5FFF", 0.05]]))).toMatchObject({ ok: false, reason: "not varied" });
    expect(varied([])).toBe(false);
  });
  it("a first screen that is mostly video or a photograph gets no match; half or less is compared", () => {
    expect(comparable(THREE, { media: "video", coverage: 0.9 })).toMatchObject({ ok: false, reason: "photo or video" });
    expect(comparable(THREE, { media: "image", coverage: 0.51 })).toMatchObject({ ok: false, reason: "photo or video" });
    expect(comparable(THREE, { media: "image", coverage: 0.5 }).ok).toBe(true);
    expect(comparable(THREE, { media: "none", coverage: 1 }).ok).toBe(true);
    expect(nearestFor("v.com", THREE, [work("1", THREE)], [], { hero: { media: "video", coverage: 1 } })).toMatchObject({ neutral: true, reason: "photo or video" });
  });
  it("a sector names its nearest group only with a third of its compared homepages and 8 at least", () => {
    const gs = groups([...Array.from({ length: 15 }, (_, i) => work(`a${i}`, THREE, { movement: "Near" })), ...Array.from({ length: 15 }, (_, i) => work(`b${i}`, OTHER, { movement: "Far" }))]);
    const sector = (near: number, far: number, neutral = 0) => nearestForSector("fintech", [
      ...Array.from({ length: near }, (_, i) => ({ domain: `n${i}.com`, palette: THREE })), ...Array.from({ length: far }, (_, i) => ({ domain: `f${i}.com`, palette: OTHER })),
      ...Array.from({ length: neutral }, (_, i) => ({ domain: `w${i}.com`, palette: [{ hex: "#FFFFFF", share: 1 }] }))], gs);
    // 16 of 24 (two thirds, 16 at least 8): named. The other group, 8 of 24, is a third and 8, so a sector of 8 near + 16 far names Far.
    expect(sector(16, 8, 3)).toMatchObject({ base: 27, compared: 24, count: 16, excluded: { "mostly neutral": 3 } });
    expect(sector(16, 8).group?.name).toBe("Near, as the Art Institute of Chicago labels it");
    expect(sector(8, 7).group?.name).toBe("Near, as the Art Institute of Chicago labels it"); // 8 of 15
    expect(sector(7, 6)).toMatchObject({ count: 7, group: null }); // 7 of 13: over a third but fewer than 8
    // Four groups, 9, 8, 8 and 8 of 33: the commonest has 8 or more but under a third, so no group stands out.
    const four = groups([THREE, OTHER, THIRD, FOURTH].flatMap((p, k) => Array.from({ length: 15 }, (_, i) => work(`g${k}-${i}`, p, { movement: `G${k}` }))));
    const mixed = [9, 8, 8, 8].flatMap((n, k) => Array.from({ length: n }, (_, i) => ({ domain: `m${k}-${i}.com`, palette: [THREE, OTHER, THIRD, FOURTH][k]! })));
    expect(nearestForSector("x", mixed, four)).toMatchObject({ compared: 33, count: 9, group: null });
  });
  it("a group is named with the museum's label in full, never an adjective alone", () => {
    const g = groups(Array.from({ length: 15 }, (_, i) => work(`c${i}`, THREE, { movement: "Chinese (culture or style)" })));
    expect(g[0]!.name).toBe("Chinese (culture or style), as the Art Institute of Chicago labels it");
    const both = groups(Array.from({ length: 15 }, (_, i) => work(`c${i}`, THREE, { movement: "Impressionism", source: i % 2 ? "aic" : "met" })));
    expect(both[0]!.name).toBe("Impressionism, as the museums label it");
  });
  it("a group pools only its comparable works and needs fifteen of them", () => {
    const paper = [{ hex: "#E8D3B0", share: 0.97 }, { hex: "#1F5FFF", share: 0.03 }];
    const ws = [...Array.from({ length: 14 }, (_, i) => work(`v${i}`, THREE, { movement: "Prints" })), ...Array.from({ length: 10 }, (_, i) => work(`p${i}`, paper, { movement: "Prints" }))];
    expect(groups(ws)).toEqual([]);
    const g = groups([...ws, work("v14", THREE, { movement: "Prints" })]);
    expect(g[0]).toMatchObject({ works: 15, stored: 25 });
    expect(g[0]!.colours.some(c => c.hex === "#E8D3B0")).toBe(false);
  });
  it("readers see nothing until 200 works and 8 groups of 15", () => {
    // The dry-run sample (297 works, 9 groups of 15) already clears the line; 150 of them do not.
    expect(readyToShow(fixture.works as never)).toEqual({ ready: true, works: 297, groups: 9 });
    expect(readyToShow(fixture.works.slice(0, 150) as never).ready).toBe(false);
    const many = Array.from({ length: SHOW_MIN_WORKS }, (_, i) => ({ movement: `M${i % 8}`, tradition: "T", year_start: 1800 }));
    expect(readyToShow(many)).toEqual({ ready: true, works: 200, groups: 8 });
    expect(readyToShow(many.slice(0, 199)).ready).toBe(false);
  });
  it("spread flags a method where one work takes more than a fifth of the matches", () => {
    const m = (k: string) => ({ domain: k, neutral: false as const, work: { w: work(k === "x" ? "same" : k, []), distance: 0.01, near: true }, group: null });
    expect(spread([m("x"), m("x"), m("a"), m("b"), m("c")]).clumps).toBe(true);
    expect(spread([m("x"), m("a"), m("b"), m("c"), m("d"), m("e")]).clumps).toBe(false);
  });
});

const body = (o: Record<string, unknown> = {}) => ({ source: "met", source_id: "436535", title: "Wheat Field with Cypresses", artist: "Vincent van Gogh", date_display: "1889", year_start: 1889, year_end: 1889,
  tradition: "European paintings", movement: null, kind: "painting", credit_line: "The Metropolitan Museum of Art. Purchase, 1993", link: "https://www.metmuseum.org/art/collection/search/436535", licence: "CC0",
  palette: [{ hex: "#3A6EA5", share: 0.4 }, { hex: "#C9B458", share: 0.3 }], width: 240, height: 190, webp_base64: b64(webp(240, 190)), ...o });

describe("the brand line (W3b, Data view only, off while MUSEUM_SHOWN is false)", () => {
  it("draws the thumbnail inside 64 px and cuts a long title so the line stays within two lines at 390 px", async () => {
    const { nearView, THUMB_MAX, TITLE_MAX } = await import("./read.server");
    const w = (o: object) => ({ source: "aic", source_id: "1", title: "T", artist: "A. Painter", date_display: "1880", year_start: 1880, tradition: "", movement: null, palette: [], link: "https://www.artic.edu/artworks/1", thumb: "art/aic-1.webp", width: 240, height: 480, credit_line: "", ...o }) as never;
    expect(THUMB_MAX).toBe(64);
    expect(nearView(w({}), 0.05, null)).toMatchObject({ width: 32, height: 64, short: "Art Institute of Chicago", credit: "A. Painter, 1880" });
    expect(nearView(w({ width: 240, height: 120 }), 0.05, null)).toMatchObject({ width: 64, height: 32 });
    const long = nearView(w({ title: "Mitsuke: Ferries Crossing the Tenryu River (Mitsuke, Tenryugawa funawatashi)" }), 0.05, null);
    expect(long.title.length).toBe(TITLE_MAX);
    expect(long.title.endsWith("…")).toBe(true);
    expect(long.line).toContain("Tenryugawa funawatashi");
  });
});

describe("museum works contract", () => {
  it("refuses anything not CC0, links off the museum's site, and shares over 1", () => {
    const parse = (o: Record<string, unknown>) => artPayload.parse({ run_id: "t", works: [body(o)] }).works[0]!;
    expect(checkWork(parse({})).ok).toBe(true);
    expect(checkWork(parse({ licence: "CC-BY" }))).toEqual({ ok: false, reason: "not_cc0" });
    expect(checkWork(parse({ link: "https://example.com/met/436535" }))).toEqual({ ok: false, reason: "wrong_link_host" });
    expect(checkWork(parse({ palette: [{ hex: "#3A6EA5", share: 0.6 }, { hex: "#C9B458", share: 0.5 }] }))).toEqual({ ok: false, reason: "palette_shares" });
    expect(checkWork(parse({ width: 200 }))).toEqual({ ok: false, reason: "dimension_mismatch" });
    expect(linkOk("aic", "https://www.artic.edu/artworks/1")).toBe(true);
    expect(linkOk("aic", "https://artic.edu.evil.com/x")).toBe(false);
    expect(linkOk("met", "http://www.metmuseum.org/x")).toBe(false);
  });
  it("bounds every field as the brief writes them", () => {
    const bad = (o: Record<string, unknown>) => artPayload.safeParse({ run_id: "t", works: [body(o)] }).success;
    expect(bad({ source_id: "x".repeat(41) })).toBe(false);
    expect(bad({ year_start: -3001 })).toBe(false);
    expect(bad({ year_start: 1900, year_end: 1899 })).toBe(false);
    expect(bad({ width: 241 })).toBe(false);
    expect(bad({ height: 481 })).toBe(false);
    expect(bad({ kind: "sculpture" })).toBe(false);
    expect(bad({ palette: [] })).toBe(false);
    expect(bad({ palette: Array.from({ length: 9 }, () => ({ hex: "#000000", share: 0.1 })) })).toBe(false);
    expect(artPayload.safeParse({ run_id: "t", works: Array.from({ length: 21 }, () => body()) }).success).toBe(false);
  });
  it("writes the reader's credit line in plain words", () => {
    expect(nearestLine({ artist: "Vincent van Gogh", title: "Wheat Field with Cypresses", date_display: "1889", source: "met" })).toBe("Nearest in the museum: Vincent van Gogh, Wheat Field with Cypresses, 1889. The Metropolitan Museum of Art. Public domain.");
    expect(nearestLine({ artist: null, title: "Bowl", date_display: "c. 1700", source: "aic" })).toBe("Nearest in the museum: Bowl, c. 1700. The Art Institute of Chicago. Public domain.");
    expect(isArtPath(artPath("met", "436535", "abcdef0123"))).toBe(true);
  });
});

function memory(): ArtStore & { rows: Map<string, StoredWork & Record<string, unknown>>; objects: Map<string, Uint8Array> } {
  const rows = new Map<string, StoredWork & Record<string, unknown>>(), objects = new Map<string, Uint8Array>();
  return { rows, objects,
    authenticate: async r => r.headers.get("x-crawl-secret") === "ok",
    existing: async keys => keys.flatMap(k => { const r = rows.get(`${k.source}:${k.source_id}`); return r ? [r] : []; }),
    upload: async (p, b) => { objects.set(p, b); }, removeObjects: async ps => { for (const p of ps) objects.delete(p); },
    save: async (row, isNew) => { const k = `${row.source}:${row.source_id}`, old = rows.get(k); if (old?.removed_at) return "removed"; rows.set(k, { ...(old ?? {}), ...row, removed_at: null, ...(isNew ? { first_seen: row.seen } : {}) }); return "ok"; },
    touch: async (s, id, seen) => { const r = rows.get(`${s}:${id}`); if (r) r["last_seen"] = seen; },
    markRemoved: async (s, id, reason, at) => { const r = rows.get(`${s}:${id}`); if (!r || r.removed_at) return null; const thumb = r.thumb; Object.assign(r, { removed_at: at, removed_reason: reason, thumb: null }); return { thumb }; },
    visible: async p => [...rows.values()].some(r => r.thumb === p && !r.removed_at),
    download: async p => objects.get(p) ?? null,
  };
}
const post = (b: unknown, secret = "ok") => new Request("https://slug.global/api/public/ingest-art", { method: "POST", headers: { "x-crawl-secret": secret, "content-type": "application/json" }, body: JSON.stringify(b) });

describe("POST /api/public/ingest-art", () => {
  it("checks the secret before anything, stores, then answers unchanged for the same work", async () => {
    const m = memory();
    expect((await handleArtIngest(post({ run_id: "r", works: [body()] }, "no"), m)).status).toBe(401);
    expect(await (await handleArtIngest(post({ run_id: "r", works: [body(), body({ source_id: "2", licence: "CC-BY" })] }), m)).json()).toEqual({ stored: 1, unchanged: 0, refused: [{ source: "met", source_id: "2", reason: "not_cc0" }] });
    expect(m.objects.size).toBe(1);
    expect(await (await handleArtIngest(post({ run_id: "r2", works: [body()] }), m)).json()).toEqual({ stored: 0, unchanged: 1, refused: [] });
  });
  it("a work removed on request loses its thumbnail and is never stored again", async () => {
    const m = memory();
    await handleArtIngest(post({ run_id: "r", works: [body()] }), m);
    const path = [...m.objects.keys()][0]!;
    expect((await serveArt(path, m)).status).toBe(200);
    expect(await removeArtWork({ source: "met", source_id: "436535", reason: "The rights holder asked." }, m)).toEqual({ removed: true, thumb_deleted: true });
    expect(m.objects.size).toBe(0);
    expect((await serveArt(path, m)).status).toBe(404);
    expect(await (await handleArtIngest(post({ run_id: "r3", works: [body({ title: "Changed" })] }), m)).json()).toEqual({ stored: 0, unchanged: 0, refused: [{ source: "met", source_id: "436535", reason: "removed" }] });
    expect(await removeArtWork({ source: "met", source_id: "436535", reason: "again" }, m)).toMatchObject({ refused: expect.stringContaining("already removed") });
    expect(await removeArtWork({ source: "met", source_id: "nope", reason: "none" }, m)).toBeNull();
  });
  it("refuses a body over 1 MB and malformed works with a plain error", async () => {
    const m = memory();
    expect((await handleArtIngest(post({ run_id: "r", pad: "x".repeat(1024 * 1024 + 10) }), m)).status).toBe(413);
    const r = await handleArtIngest(post({ run_id: "r", works: [body({ kind: "sculpture" })] }), m);
    expect(r.status).toBe(400);
  });
});
