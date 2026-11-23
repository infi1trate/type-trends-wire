// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COPY_META, createPageCache, hasFailedPart, servePage } from "./page-cache";
import { READ_CACHE_CONTROL } from "./edge-cache";

const html = (body = "<p>page</p>", init: ResponseInit = {}) => new Response(body, { status: 200, ...init, headers: { "content-type": "text/html; charset=utf-8", ...(init.headers as Record<string, string> | undefined) } });
function setup(now = () => Date.now()) {
  const cache = createPageCache({ now }), waits: Promise<unknown>[] = [];
  let renders = 0;
  const get = async (url: string, headers: Record<string, string> = {}, make: () => Response = () => html()) => {
    const res = await servePage(new Request(url, { headers }), false, cache, async () => { renders++; return make(); }, p => waits.push(p), { now });
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
    // D1 Part 5 · past five minutes the copy is sent at once and redrawn after the answer (with the host's waitUntil).
    now = 301_000; expect((await t.get("https://slug.global/patterns")).res.headers.get("x-read-cache")).toBe("stale");
    expect(t.renders()).toBe(2);
    now = 302_000; expect((await t.get("https://slug.global/patterns")).res.headers.get("x-read-cache")).toBe("hit");
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

// D1 Part 5 · the rehearsal: the database unreachable, every Read page and the Terminal still send their full last good copy within 2 s,
// with its time for the quiet line. Readers only: a job never comes through the page cache.
describe("D1 Part 5 · readers on last good copies", () => {
  const PAGES = ["/", "/signals", "/brands", "/patterns", "/data", "/digest", "/stories/move:3688", "/brands/figma.com", "/terminal?panel=today&q=&sort=domain&desc=false&page=0"];
  const page = (p: string) => `<html><head><title>${p}</title></head><body><main><h1>${p}</h1><p>full content</p></main></body></html>`;
  it("with the database down, each page answers from its last good copy in under 2 s", async () => {
    let now = 0;
    const cache = createPageCache({ now: () => now }), waits: Promise<unknown>[] = [];
    for (const p of PAGES) {
      const r = await servePage(new Request(`https://slug.global${p}`), false, cache, async () => html(page(p)), w => waits.push(w), { now: () => now, degraded: async () => false });
      await r.text(); await Promise.all(waits);
    }
    now = 3 * 3600_000; // three hours later, the database stops answering: a render would never finish
    for (const p of PAGES) {
      const t0 = Date.now();
      const r = await servePage(new Request(`https://slug.global${p}`), false, cache, () => new Promise<Response>(() => {}), w => waits.push(w), { now: () => now, degraded: async () => true });
      const body = await r.text();
      expect(Date.now() - t0, p).toBeLessThan(2_000);
      expect(r.headers.get("x-read-cache"), p).toBe("last-good");
      expect(body, p).toContain("full content");
      expect(body, p).toContain(`<meta name="${COPY_META}" content="1970-01-01T00:00:00.000Z">`);
    }
  });
  it("a render that fails sends the last good copy instead; a page with a failed part never replaces it", async () => {
    let now = 0;
    const cache = createPageCache({ now: () => now }), waits: Promise<unknown>[] = [];
    const get = async (make: () => Promise<Response>) => { const r = await servePage(new Request("https://slug.global/signals"), false, cache, make, w => waits.push(w), { now: () => now }); const b = await r.text(); await Promise.all(waits); return { r, b }; };
    await get(async () => html("<head></head><p>good</p>"));
    now = 2 * 3600_000;
    expect((await get(async () => new Response("x", { status: 500, headers: { "content-type": "text/html" } }))).b).toContain("good");
    await get(async () => html('<head></head><p>part <span data-later-failed="">failed</span></p>'));
    expect(hasFailedPart('<p data-later-failed="">x</p>')).toBe(true);
    now = 5 * 3600_000;
    expect((await get(async () => new Response("x", { status: 503, headers: { "content-type": "text/html" } }))).b).toContain("good");
  });
  it("the Terminal is kept only as a last good copy: with the database up it is always drawn fresh", async () => {
    const cache = createPageCache(), waits: Promise<unknown>[] = [];
    let renders = 0;
    for (let i = 0; i < 2; i++) { const r = await servePage(new Request("https://slug.global/terminal?panel=today"), false, cache, async () => { renders++; return html("<head></head>t"); }, w => waits.push(w), { degraded: async () => false }); await r.text(); await Promise.all(waits); }
    expect(renders).toBe(2);
  });
});
