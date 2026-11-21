// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deleteCropsFor, deleteImagesFor, handleCropIngest, serveCrop, type CropStore, type StoredAsset, type StoredCrop } from "./crops-ingest.server";
import { handleThumbOptout, type ThumbStore } from "./thumbs-ingest.server";
import { CROP_LIMITS } from "./crops";
import { b64, png, webp } from "./__fixtures__/webp";

const SECRET = "test-only-secret";
function memory(opts: { tracked?: string[]; optouts?: string[] } = {}) {
  const objects = new Map<string, Uint8Array>(), rows: StoredCrop[] = [], assets: StoredAsset[] = [], optouts = new Set(opts.optouts ?? []), tracked = new Set(opts.tracked ?? ["vercel.com", "linear.app"]);
  let id = 0;
  const store: CropStore = {
    async authenticate(r) { return r.headers.get("x-crawl-secret") === SECRET; },
    async trackedDomains(d) { return new Set(d.filter(x => tracked.has(x))); },
    async optedOut(d) { return new Set(d.filter(x => optouts.has(x))); },
    async versions(domain, section, viewport) { return rows.filter(r => r.domain === domain && r.section === section && r.viewport === viewport).sort((a, b) => b.captured_at.localeCompare(a.captured_at)); },
    async touch(i, at) { const r = rows.find(x => x.id === i)!; r.last_seen_at = at; },
    async upload(path, bytes) { objects.set(path, bytes); },
    async insert(row) { if (optouts.has(row.domain)) return "opted_out"; if (rows.some(r => r.path === row.path)) return "exists"; rows.push({ ...row, id: ++id }); return "ok"; },
    async removeObjects(paths) { for (const p of paths) objects.delete(p); },
    async deleteRows(ids) { for (const i of ids) rows.splice(rows.findIndex(r => r.id === i), 1); },
    async domainRows(domain) { return rows.filter(r => r.domain === domain); },
    async visibleRow(path) { const r = rows.find(x => x.path === path); return r && !optouts.has(r.domain) ? { domain: r.domain } : null; },
    async download(path) { return objects.get(path) ?? null; },
    async assetVersions(domain, kind) { return assets.filter(r => r.domain === domain && r.kind === kind).sort((a, b) => b.captured_at.localeCompare(a.captured_at)); },
    async touchAsset(i, at) { const r = assets.find(x => x.id === i)!; r.last_seen_at = at; },
    async insertAsset(row) { if (optouts.has(row.domain)) return "opted_out"; if (assets.some(r => r.path === row.path)) return "exists"; assets.push({ ...row, id: ++id }); return "ok"; },
    async deleteAssetRows(ids) { for (const i of ids) assets.splice(assets.findIndex(r => r.id === i), 1); },
    async domainAssets(domain) { return assets.filter(r => r.domain === domain); },
    async visibleAsset(path) { const r = assets.find(x => x.path === path); return r && !optouts.has(r.domain) ? { domain: r.domain } : null; },
  };
  return { store, objects, rows, assets, optouts };
}
const hash = (n: number) => n.toString(16).padStart(16, "0");
const cap = (o: Record<string, unknown> = {}) => ({ domain: "vercel.com", section: "hero", viewport: "desktop", captured_at: "2026-11-15T06:00:00Z", width: 1280, height: 800, hash: hash(1), webp_base64: b64(webp(1280, 800)), ...o });
const post = (body: unknown, secret: string | null = SECRET) => new Request("http://localhost/api/public/ingest-crops", { method: "POST", headers: { "content-type": "application/json", ...(secret ? { "x-crawl-secret": secret } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) });
const send = async (m: ReturnType<typeof memory>, captures: unknown[], secret: string | null = SECRET) => { const res = await handleCropIngest(post({ run_id: "run-1", captures }, secret), m.store); return { status: res.status, body: await res.json() }; };

describe("POST /api/public/ingest-crops", () => {
  it("401 without the right secret, before anything is stored", async () => {
    const m = memory();
    expect(await send(m, [cap()], null)).toEqual({ status: 401, body: { error: "Missing or wrong x-crawl-secret" } });
    expect((await send(m, [cap()], "wrong")).status).toBe(401);
    expect(m.rows).toHaveLength(0);
  });
  it("413 over 4 MB", async () => {
    const m = memory(), res = await handleCropIngest(post("x".repeat(CROP_LIMITS.requestBytes + 1)), m.store);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Body exceeds 4 MB" });
  });
  it("400 with a plain reason for malformed bodies, unknown sections and bad counts", async () => {
    const m = memory();
    const bad = await handleCropIngest(post("{nope"), m.store);
    expect([bad.status, await bad.json()]).toEqual([400, { error: "Body is not valid JSON" }]);
    const sec = await send(m, [cap({ section: "logo" })]);
    expect(sec.status).toBe(400); expect(sec.body.error).toBe('captures.0.section: unknown section "logo" (expected hero, nav, pricing, cta, footer, icon, card)');
    expect((await send(m, [])).status).toBe(400);
    expect((await send(m, Array.from({ length: 13 }, (_, i) => cap({ hash: hash(i + 1) })))).status).toBe(400);
    expect((await send(m, [cap({ width: 1281 })])).status).toBe(400);
    expect((await send(m, [cap({ hash: "xyz" })])).status).toBe(400);
    expect(m.rows).toHaveLength(0);
  });
  it("refuses bad WebP, oversize images and dimension mismatches per capture", async () => {
    const m = memory();
    const r = await send(m, [cap({ webp_base64: b64(png()) }), cap({ section: "nav", webp_base64: b64(webp(1280, 800, { bytes: 150 * 1024 + 1 })) }), cap({ section: "cta", width: 1200 }), cap({ section: "footer", webp_base64: b64(new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])) })]);
    expect(r.status).toBe(200);
    expect(r.body.stored).toBe(0);
    expect(r.body.refused.map((x: { section: string; reason: string }) => `${x.section}:${x.reason}`)).toEqual(["hero:not_webp", "nav:over_150kb", "cta:dimension_mismatch", "footer:bad_webp"]);
  });
  it("refuses untracked and opted-out domains", async () => {
    const m = memory({ optouts: ["linear.app"] });
    const r = await send(m, [cap({ domain: "example.org" }), cap({ domain: "linear.app" })]);
    expect(r.body).toEqual({ stored: 0, unchanged: 0, refused: [{ domain: "example.org", section: "hero", reason: "untracked_domain" }, { domain: "linear.app", section: "hero", reason: "opted_out" }] });
    expect(m.objects.size).toBe(0);
  });
  it("stores a new version at <domain>/<section>/<day>-<hash8>.webp", async () => {
    const m = memory(), r = await send(m, [cap({ hash: "ABCDEF0123456789" })]);
    expect(r.body).toEqual({ stored: 1, unchanged: 0, refused: [] });
    expect(m.rows[0]).toMatchObject({ path: "vercel.com/hero/2026-11-15-abcdef01.webp", hash: "abcdef0123456789", width: 1280, height: 800, run_id: "run-1", first_seen_at: "2026-11-15T06:00:00Z", last_seen_at: "2026-11-15T06:00:00Z" });
    expect(m.objects.has("vercel.com/hero/2026-11-15-abcdef01.webp")).toBe(true);
  });
  it("I3b: a newly stored crop is measured once at intake; an unchanged one is not, and a failed measurement does not refuse the crop", async () => {
    const m = memory(), seen: string[] = [];
    m.store.measure = async c => { seen.push(c.path); };
    await send(m, [cap()]);
    await send(m, [cap({ captured_at: "2026-11-22T06:00:00Z" })]);
    expect(seen).toEqual(["vercel.com/hero/2026-11-15-00000000.webp"]);
    m.store.measure = async () => { throw new Error("decode failed"); };
    expect((await send(m, [cap({ section: "nav", hash: hash(2) })])).body).toEqual({ stored: 1, unchanged: 0, refused: [] });
  });
  it("same hash as the newest version: no new image, last_seen_at moves forward, counted unchanged", async () => {
    const m = memory();
    await send(m, [cap()]);
    const r = await send(m, [cap({ captured_at: "2026-11-22T06:00:00Z" })]);
    expect(r.body).toEqual({ stored: 0, unchanged: 1, refused: [] });
    expect(m.rows).toHaveLength(1); expect(m.objects.size).toBe(1);
    expect(m.rows[0]!.last_seen_at).toBe("2026-11-22T06:00:00Z");
    expect(m.rows[0]!.first_seen_at).toBe("2026-11-15T06:00:00Z");
  });
  it("a different hash stores a new version; the 13th evicts the oldest version and its object", async () => {
    const m = memory();
    for (let i = 1; i <= 12; i++) await send(m, [cap({ hash: hash(i), captured_at: `2026-0${i < 10 ? i : 9}-${String(i).padStart(2, "0")}T06:00:00Z` })]);
    expect(m.rows).toHaveLength(12);
    const oldest = m.rows.find(r => r.hash === hash(1))!.path;
    const r = await send(m, [cap({ hash: hash(13), captured_at: "2026-11-20T06:00:00Z" })]);
    expect(r.body.stored).toBe(1);
    expect(m.rows).toHaveLength(12);
    expect(m.rows.some(x => x.hash === hash(1))).toBe(false);
    expect(m.objects.has(oldest)).toBe(false);
    expect(m.objects.size).toBe(12);
  });
  it("E2c: a crop a published story cites is never evicted, and an owner's removal still deletes it", async () => {
    const m = memory(), kept = new Set<number>();
    m.store.keptIds = async ids => new Set(ids.filter(i => kept.has(i)));
    for (let i = 1; i <= 12; i++) await send(m, [cap({ hash: hash(i), captured_at: `2026-0${i < 10 ? i : 9}-${String(i).padStart(2, "0")}T06:00:00Z` })]);
    const oldest = m.rows.find(r => r.hash === hash(1))!; kept.add(oldest.id);
    await send(m, [cap({ hash: hash(13), captured_at: "2026-11-20T06:00:00Z" })]);
    expect(m.rows.some(x => x.hash === hash(1))).toBe(true);
    expect(m.rows).toHaveLength(13); // the kept crop does not count toward the 12
    await send(m, [cap({ hash: hash(15), captured_at: "2026-11-19T06:00:00Z" })]);
    expect(m.rows.some(x => x.hash === hash(2))).toBe(false); expect(m.rows.some(x => x.hash === hash(1))).toBe(true);
    // The kept-crop lookup failing evicts nothing (never a kept crop by mistake).
    m.store.keptIds = async () => { throw new Error("down"); };
    await send(m, [cap({ hash: hash(14), captured_at: "2026-11-21T06:00:00Z" })]);
    expect(m.rows).toHaveLength(14);
    expect(await deleteCropsFor("vercel.com", m.store)).toBe(14);
    expect(m.rows).toHaveLength(0); expect(m.objects.size).toBe(0);
  });
  it("opt-out cleanup deletes every crop of the domain", async () => {
    const m = memory();
    await send(m, [cap(), cap({ section: "nav" }), cap({ domain: "linear.app" })]);
    expect(await deleteCropsFor("vercel.com", m.store)).toBe(2);
    expect(m.rows.map(r => r.domain)).toEqual(["linear.app"]);
    expect([...m.objects.keys()]).toEqual(["linear.app/hero/2026-11-15-00000000.webp"]);
  });
});

describe("GET /crops/<path>", () => {
  it("serves a stored crop as WebP with a private long cache", async () => {
    const m = memory(); await send(m, [cap()]);
    const res = await serveCrop("vercel.com/hero/2026-11-15-00000000.webp", m.store);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("private, max-age=604800, immutable");
  });
  it("never serves an opted-out domain, unknown paths or traversal", async () => {
    const m = memory(); await send(m, [cap()]);
    m.optouts.add("vercel.com");
    expect((await serveCrop("vercel.com/hero/2026-11-15-00000000.webp", m.store)).status).toBe(404);
    expect((await serveCrop("vercel.com/logo/2026-11-15-00000000.webp", m.store)).status).toBe(404);
    expect((await serveCrop("../secret/hero/2026-11-15-00000000.webp", m.store)).status).toBe(404);
    expect((await serveCrop("linear.app/hero/2026-11-15-00000000.webp", m.store)).status).toBe(404);
  });
});

describe("I1 · brand assets (site icon, social card) in the crop payload", () => {
  const icon = (o: Record<string, unknown> = {}) => cap({ section: "icon", width: 180, height: 180, hash: hash(901), webp_base64: b64(webp(180, 180)), ...o });
  const card = (o: Record<string, unknown> = {}) => cap({ section: "card", width: 1200, height: 630, hash: hash(902), webp_base64: b64(webp(1200, 630)), ...o });
  it("a mixed batch stores the hero crop in crops and the icon and card in brand assets", async () => {
    const m = memory(), r = await send(m, [cap(), icon(), card()]);
    expect(r.body).toEqual({ stored: 3, unchanged: 0, refused: [] });
    expect(m.rows.map(x => x.section)).toEqual(["hero"]);
    expect(m.assets.map(x => [x.kind, x.path, x.width, x.height])).toEqual([
      ["icon", "assets/vercel.com/icon/2026-11-15-00000000.webp", 180, 180],
      ["card", "assets/vercel.com/card/2026-11-15-00000000.webp", 1200, 630],
    ]);
    expect(m.objects.size).toBe(3);
  });
  it("refuses an icon of 40 px and one of 300 px, each on its own", async () => {
    const m = memory(), r = await send(m, [icon({ width: 40, height: 40, webp_base64: b64(webp(40, 40)) }), icon({ width: 300, height: 300, hash: hash(903), webp_base64: b64(webp(300, 300)) }), card()]);
    expect(r.body.stored).toBe(1);
    expect(r.body.refused).toEqual([{ domain: "vercel.com", section: "icon", reason: "icon_too_small" }, { domain: "vercel.com", section: "icon", reason: "icon_too_large" }]);
    expect(m.assets.map(x => x.kind)).toEqual(["card"]);
  });
  it("refuses an opted-out brand's icon and the same crop refusals (not WebP, size mismatch)", async () => {
    const m = memory({ optouts: ["linear.app"] });
    const r = await send(m, [icon({ domain: "linear.app" }), icon({ webp_base64: b64(png()) }), card({ width: 1100 })]);
    expect(r.body.refused.map((x: { reason: string }) => x.reason)).toEqual(["opted_out", "not_webp", "dimension_mismatch"]);
    expect(m.assets).toHaveLength(0); expect(m.objects.size).toBe(0);
  });
  it("the same hash twice only moves last_seen_at", async () => {
    const m = memory();
    await send(m, [icon()]);
    const r = await send(m, [icon({ captured_at: "2026-11-22T06:00:00Z" })]);
    expect(r.body).toEqual({ stored: 0, unchanged: 1, refused: [] });
    expect(m.assets).toHaveLength(1);
    expect(m.assets[0]).toMatchObject({ first_seen_at: "2026-11-15T06:00:00Z", last_seen_at: "2026-11-22T06:00:00Z" });
  });
  it("keeps the newest 12 versions per brand and kind", async () => {
    const m = memory();
    for (let i = 1; i <= 13; i++) await send(m, [icon({ hash: hash(1000 + i), captured_at: `2026-${String(Math.min(i, 11)).padStart(2, "0")}-${String(i).padStart(2, "0")}T06:00:00Z` })]);
    expect(m.assets).toHaveLength(12);
    expect(m.assets.some(x => x.hash === hash(1001))).toBe(false);
  });
  it("serves an asset through /crops/assets/… and answers 404 once hidden or opted out", async () => {
    const m = memory(); await send(m, [icon()]);
    const path = "assets/vercel.com/icon/2026-11-15-00000000.webp";
    const ok = await serveCrop(path, m.store);
    expect([ok.status, ok.headers.get("content-type"), ok.headers.get("cache-control")]).toEqual([200, "image/webp", "private, max-age=604800, immutable"]);
    expect((await serveCrop("assets/vercel.com/logo/2026-11-15-00000000.webp", m.store)).status).toBe(404);
    m.optouts.add("vercel.com");
    expect((await serveCrop(path, m.store)).status).toBe(404);
  });
  it("opt-out removes a brand's crops and assets together, and a removed asset's path answers 404", async () => {
    const m = memory();
    await send(m, [cap(), icon(), card(), cap({ domain: "linear.app" })]);
    const thumbs: ThumbStore = {
      async authenticate(r) { return r.headers.get("x-crawl-secret") === SECRET; }, async activeDomains() { return new Set(); }, async optedOut() { return new Set(); },
      async upload() {}, async upsertRow() { return "ok"; }, async rows() { return []; }, async removeObjects() {}, async deleteRows() {},
      async addOptout(d) { m.optouts.add(d); }, async removeOptout(d) { m.optouts.delete(d); },
    };
    const res = await handleThumbOptout(new Request("http://localhost/api/public/thumb-optout", { method: "POST", headers: { "content-type": "application/json", "x-crawl-secret": SECRET }, body: JSON.stringify({ domain: "vercel.com" }) }), thumbs, m.store);
    expect(await res.json()).toMatchObject({ ok: true, crops_deleted: 1, assets_deleted: 2 });
    expect(m.assets).toHaveLength(0);
    expect([...m.objects.keys()]).toEqual(["linear.app/hero/2026-11-15-00000000.webp"]);
    m.optouts.delete("vercel.com");
    expect((await serveCrop("assets/vercel.com/icon/2026-11-15-00000000.webp", m.store)).status).toBe(404);
    expect(await deleteImagesFor("vercel.com", m.store)).toEqual({ crops: 0, assets: 0 });
  });
});
