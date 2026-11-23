import { beforeEach, describe, expect, it } from "vitest";
import { PICTURE_MEMORY_MS, forgetPictures, servePicture, type PictureStore } from "./pictures-serve.server";
import { mainPathOf as thumbsMain, THUMB_PATH_RE } from "./thumbs";
import { parseAssetPath } from "./brand-assets";
import { parseCropPath, parseSurfacePath } from "./crops";
import { cropRefOf } from "./picture-paths";

type Rows = Partial<Record<string, Record<string, Record<string, unknown>>>>;
function store(rows: Rows, opted: string[] = [], objects: Record<string, number> = {}) {
  const calls: string[] = [];
  const s: PictureStore = {
    visible: async (table, _col, value) => { calls.push(`row ${table}`); return rows[table]?.[value] ?? null; },
    optedOut: async d => { calls.push("optout"); return opted.includes(d); },
    bytes: async (bucket, path) => { calls.push(`bytes ${bucket}`); const n = objects[`${bucket}/${path}`]; return n ? new Uint8Array(n) : null; },
  };
  return { s, calls };
}
const T0 = Date.parse("2026-11-23T19:00:00Z");
beforeEach(() => forgetPictures());

describe("C1b · the picture route keeps the old route's checks", () => {
  const thumb = "vercel.com/2026-11-22-desktop.webp", w640 = "vercel.com/2026-11-22-desktop-640w.webp";
  const rows: Rows = { site_thumbs: { [thumb]: { path: thumb, variants: [{ path: w640, w: 640 }] } } };
  const objects = { [`site-thumbs/${thumb}`]: 15630, [`site-thumbs/${w640}`]: 6166 };
  it("serves a thumbnail and its listed rendition with the same headers as before", async () => {
    const { s } = store(rows, [], objects);
    const a = await servePicture("thumbs", thumb, s, T0), b = await servePicture("thumbs", w640, s, T0);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(b.headers.get("content-length")).toBe("6166");
    expect(b.headers.get("cache-control")).toBe("public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400");
    expect(b.headers.get("content-type")).toBe("image/webp");
  });
  it("refuses a rendition its row does not list, a removed thumbnail (no visible row) and a malformed address", async () => {
    const { s } = store(rows, [], objects);
    expect((await servePicture("thumbs", "vercel.com/2026-11-22-desktop-320w.webp", s, T0)).status).toBe(404);
    expect((await servePicture("thumbs", "netlify.com/2026-11-22-desktop.webp", s, T0)).status).toBe(404);
    expect((await servePicture("thumbs", "../secret/x.webp", s, T0)).status).toBe(404);
  });
  it("a crop needs its visible row for this exact address, the same brand, and no opt-out", async () => {
    const crop = "netlify.com/hero/2026-11-20-ffffffff.webp", card = "assets/netlify.com/card/2026-11-20-ffc0ff80.webp";
    const r: Rows = { site_crops: { [crop]: { domain: "netlify.com" } }, brand_assets: { [card]: { domain: "netlify.com" } } };
    const o = { [`site-crops/${crop}`]: 20000, [`site-crops/${card}`]: 26000 };
    expect((await servePicture("crops", crop, store(r, [], o).s, T0)).headers.get("cache-control")).toBe("private, max-age=604800, immutable");
    expect((await servePicture("crops", card, store(r, [], o).s, T0)).status).toBe(200);
    forgetPictures();
    expect((await servePicture("crops", crop, store(r, ["netlify.com"], o).s, T0)).status).toBe(404);
    expect((await servePicture("crops", crop, store({ site_crops: { [crop]: { domain: "other.com" } } }, [], o).s, T0)).status).toBe(404);
    expect((await servePicture("crops", "netlify.com/hero/2026-11-21-ffffffff.webp", store(r, [], o).s, T0)).status).toBe(404);
  });
  it("a museum thumbnail is served only while its work is not removed", async () => {
    const art = "art/met-436535-0a1b2c3d.webp";
    const o = { [`site-crops/${art}`]: 9000 };
    expect((await servePicture("crops", art, store({ art_works: { [art]: { id: 1 } } }, [], o).s, T0)).headers.get("cache-control")).toBe("private, max-age=86400");
    forgetPictures();
    expect((await servePicture("crops", art, store({}, [], o).s, T0)).status).toBe(404);
  });
  it("a served picture is kept in memory for ten minutes at most: a removal stops it within the hour", async () => {
    const live = store(rows, [], objects), gone = store({}, [], objects);
    expect((await servePicture("thumbs", thumb, live.s, T0)).status).toBe(200);
    expect((await servePicture("thumbs", thumb, gone.s, T0 + PICTURE_MEMORY_MS - 1)).status).toBe(200);
    expect(gone.calls).toEqual([]);
    expect((await servePicture("thumbs", thumb, gone.s, T0 + PICTURE_MEMORY_MS)).status).toBe(404);
    expect(PICTURE_MEMORY_MS).toBeLessThanOrEqual(60 * 60_000);
  });
  it("a 404 is never kept: a picture that appears is served on the next request", async () => {
    expect((await servePicture("thumbs", thumb, store({}, [], objects).s, T0)).status).toBe(404);
    expect((await servePicture("thumbs", thumb, store(rows, [], objects).s, T0 + 1)).status).toBe(200);
  });
  it("a failing read answers 404, never an error page", async () => {
    const s: PictureStore = { visible: async () => { throw new Error("down"); }, optedOut: async () => false, bytes: async () => null };
    expect((await servePicture("thumbs", thumb, s, T0)).status).toBe(404);
  });
});

describe("C1b · one address rule", () => {
  it("the route's classifier agrees with the intake's parsers", () => {
    for (const p of ["netlify.com/hero/2026-11-20-ffffffff.webp", "assets/netlify.com/card/2026-11-20-ffc0ff80.webp", "netlify.com/page-about/2026-11-20-0000aaaa.webp", "art/aic-123-0a1b2c3d.webp", "Netlify.com/hero/2026-11-20-ffffffff.webp", "assets/x/card/2026-11-20-ffc0ff80.webp", "netlify.com/hero/2026-11-20-FFFFFFFF.webp"]) {
      const ref = cropRefOf(p), domain = parseAssetPath(p)?.domain ?? parseSurfacePath(p)?.domain ?? parseCropPath(p)?.domain ?? null;
      expect(ref && "domain" in ref ? ref.domain : null).toBe(domain);
    }
    expect(THUMB_PATH_RE.test("vercel.com/2026-11-22-mobile-320w.webp")).toBe(true);
    expect(thumbsMain("vercel.com/2026-11-22-mobile-320w.webp")).toBe("vercel.com/2026-11-22-mobile.webp");
  });
});
