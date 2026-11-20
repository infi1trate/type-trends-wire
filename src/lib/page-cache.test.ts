// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPageCache, servePage } from "./page-cache";
import { READ_CACHE_CONTROL } from "./edge-cache";

const html = (body = "<p>page</p>", init: ResponseInit = {}) => new Response(body, { status: 200, ...init, headers: { "content-type": "text/html; charset=utf-8", ...(init.headers as Record<string, string> | undefined) } });
function setup(now = () => Date.now()) {
  const cache = createPageCache({ now }), waits: Promise<unknown>[] = [];
  let renders = 0;
  const get = async (url: string, headers: Record<string, string> = {}, make: () => Response = () => html()) => {
    const res = await servePage(new Request(url, { headers }), false, cache, async () => { renders++; return make(); }, p => waits.push(p));
    const body = await res.text(); await Promise.all(waits);
    return { res, body };
  };
  return { cache, get, renders: () => renders };
}

describe("page cache (I1 · Part 0)", () => {
  it("a second request for the same public page inside five minutes is a hit", async () => {
    const t = setup();
    const a = await t.get("https://slug.global/brands/gopro.com");
    expect(a.res.headers.get("x-read-cache")).toBe("miss");
    const b = await t.get("https://slug.global/brands/gopro.com?utm_source=x");
    expect(b.res.headers.get("x-read-cache")).toBe("hit");
    expect(b.body).toBe("<p>page</p>");
    expect(t.renders()).toBe(1);
  });
  it("every public Read page sends the shared-cache header, hit or miss", async () => {
    const t = setup();
    for (const p of ["/", "/brands", "/patterns", "/digest/2026-W46", "/data/who-went-big-first", "/signals/aesthetic:brutalist", "/stories/move:3688"]) {
      const a = await t.get(`https://slug.global${p}`), b = await t.get(`https://slug.global${p}`);
      expect([a.res.headers.get("cache-control"), b.res.headers.get("cache-control"), b.res.headers.get("cdn-cache-control")]).toEqual([READ_CACHE_CONTROL, READ_CACHE_CONTROL, READ_CACHE_CONTROL]);
    }
  });
  it("expires after five minutes", async () => {
    let now = 0; const t = setup(() => now);
    await t.get("https://slug.global/patterns");
    now = 299_000; expect((await t.get("https://slug.global/patterns")).res.headers.get("x-read-cache")).toBe("hit");
    now = 301_000; expect((await t.get("https://slug.global/patterns")).res.headers.get("x-read-cache")).toBe("miss");
  });
  it("a staff page, an API route and a request with an Authorization header are never hits", async () => {
    const t = setup();
    for (const [url, h] of [["https://slug.global/desk", {}], ["https://slug.global/api/public/health", {}], ["https://slug.global/brands/gopro.com", { authorization: "Bearer x" }]] as const) {
      await t.get(url, h); const b = await t.get(url, h);
      expect(b.res.headers.get("x-read-cache")).toBeNull();
    }
    expect(t.renders()).toBe(6);
  });
  it("never keeps an error, a cookie-setting answer or a non-HTML answer", async () => {
    const t = setup();
    await t.get("https://slug.global/brands/nope.com", {}, () => new Response("x", { status: 404, headers: { "content-type": "text/html" } }));
    await t.get("https://slug.global/brands", {}, () => html("x", { headers: { "set-cookie": "a=1" } }));
    expect(t.cache.size()).toBe(0);
  });
  it("keeps at most 60 pages, the oldest dropped first", () => {
    const c = createPageCache();
    for (let i = 0; i < 61; i++) c.put(`k${i}`, { status: 200, headers: [], body: String(i) });
    expect(c.size()).toBe(60);
    expect(c.get("k0")).toBeNull();
    expect(c.get("k60")?.body).toBe("60");
  });
});
