// @vitest-environment node
import { describe, expect, it } from "vitest";
import { chromatic, distance, groupOf, groups, nearestFor, nearestForSector, readyToShow, spread, NEAR_DISTANCE, GROUP_MIN_WORKS, SHOW_MIN_WORKS, type Work } from "./palette";
import { artPayload, checkWork, linkOk, nearestLine, artPath, isArtPath } from "./contract";
import { handleArtIngest, removeArtWork, serveArt, type ArtStore, type StoredWork } from "./ingest.server";
import fixture from "./__fixtures__/dry-run-works.json";
import { b64, webp } from "../__fixtures__/webp";

const work = (id: string, palette: { hex: string; share: number }[], o: Partial<Work> = {}): Work => ({ source: "aic", source_id: id, title: `Work ${id}`, artist: "A. Painter", date_display: "1880", year_start: 1880, tradition: "European paintings", movement: null, palette, ...o });

describe("nearest palette", () => {
  it("sets near-neutrals aside: a white page and a white wall are not a match", () => {
    expect(chromatic([{ hex: "#FFFFFF", share: 0.8 }, { hex: "#F4F1EA", share: 0.15 }, { hex: "#111111", share: 0.05 }])).toMatchObject({ ok: false, reason: "mostly neutral" });
    const kept = chromatic([{ hex: "#FFFFFF", share: 0.6 }, { hex: "#1F5FFF", share: 0.3 }, { hex: "#FF5A1F", share: 0.1 }]);
    expect(kept.ok && kept.colours.map(c => c.hex)).toEqual(["#1F5FFF", "#FF5A1F"]);
    expect(kept.ok && kept.colours.reduce((a, c) => a + c.w, 0)).toBeCloseTo(1, 9);
  });
  it("a brand with one colour left after neutrals is mostly neutral", () => {
    expect(nearestFor("x.com", [{ hex: "#FFFFFF", share: 0.9 }, { hex: "#1F5FFF", share: 0.1 }], [], [])).toEqual({ domain: "x.com", neutral: true, colourShare: 0.1 });
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
    expect(groupOf({ movement: "Japanese (culture or style)", tradition: "Asian Art", year_start: 1820 }).name).toBe("Japanese");
    expect(groupOf({ movement: null, tradition: "European paintings", year_start: 1863 }).name).toBe("European paintings, 1850 to 1899");
    const ws = Array.from({ length: GROUP_MIN_WORKS - 1 }, (_, i) => work(String(i), [{ hex: "#1F5FFF", share: 0.5 }, { hex: "#FF5A1F", share: 0.5 }]));
    expect(groups(ws)).toEqual([]);
    const g = groups([...ws, work("x", [{ hex: "#2E7D32", share: 0.5 }, { hex: "#FF5A1F", share: 0.5 }])]);
    expect(g).toHaveLength(1);
    // Built from all its works, not from one: green from one work of fifteen is in the pool at a fifteenth of a half.
    const green = g[0]!.colours.find(c => c.hex === "#2E7D32");
    expect(green?.w).toBeCloseTo(0.5 / 15, 6);
  });
  it("a nearest work is kept only under the near threshold", () => {
    const brand = [{ hex: "#1F5FFF", share: 0.5 }, { hex: "#FF5A1F", share: 0.5 }];
    const close = nearestFor("b.com", brand, [work("1", [{ hex: "#2160FA", share: 0.5 }, { hex: "#FA5C22", share: 0.5 }])], []);
    const far = nearestFor("b.com", brand, [work("2", [{ hex: "#2E7D32", share: 0.5 }, { hex: "#8E24AA", share: 0.5 }])], []);
    expect(!close.neutral && close.work?.near).toBe(true);
    expect(!far.neutral && far.work?.near).toBe(false);
    expect(!far.neutral && far.work!.distance).toBeGreaterThan(NEAR_DISTANCE);
  });
  it("a sector's nearest group carries its count and base", () => {
    const gws = (hex: string, mv: string) => Array.from({ length: 15 }, (_, i) => work(`${mv}${i}`, [{ hex, share: 0.6 }, { hex: "#FF5A1F", share: 0.4 }], { movement: mv }));
    const gs = groups([...gws("#1F5FFF", "Blue"), ...gws("#2E7D32", "Green")]);
    const s = nearestForSector("fintech", [
      { domain: "a.com", palette: [{ hex: "#1F5FFF", share: 0.6 }, { hex: "#FF5A1F", share: 0.4 }] },
      { domain: "b.com", palette: [{ hex: "#2160FA", share: 0.6 }, { hex: "#FF5A1F", share: 0.4 }] },
      { domain: "c.com", palette: [{ hex: "#FFFFFF", share: 1 }] },
    ], gs);
    expect(s).toMatchObject({ sector: "fintech", base: 3, neutral: 1, count: 2 });
    expect(s.group?.name).toBe("Blue");
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
