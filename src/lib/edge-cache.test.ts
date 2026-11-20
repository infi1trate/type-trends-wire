import { describe, expect, it } from "vitest";
import { READ_CACHE_CONTROL, isReadPath, readCacheKey, shareable } from "./edge-cache";

const req = (url: string, o: { method?: string; auth?: boolean } = {}) => ({ method: o.method ?? "GET", url: `https://slug.global${url}`, headers: new Headers(o.auth ? { authorization: "Bearer x" } : {}) });
const html = (status = 200, extra: Record<string, string> = {}) => ({ status, headers: new Headers({ "content-type": "text/html; charset=utf-8", ...extra }) });

describe("shared cache for public Read pages (P1)", () => {
  it("uses the five-minute shared header with a day of stale-while-revalidate", () => {
    expect(READ_CACHE_CONTROL).toBe("public, s-maxage=300, stale-while-revalidate=86400");
  });
  it("caches Read pages and never staff, terminal, agency or API paths", () => {
    for (const p of ["/", "/brands", "/brands/gopro.com", "/patterns", "/patterns/aesthetic:brutalist", "/signals", "/signals/aesthetic:brutalist", "/stories/abc", "/digest/2026-W46", "/data/who-went-big-first", "/collections", "/sectors/fintech"]) expect(isReadPath(p), p).toBe(true);
    for (const p of ["/desk", "/status", "/status/launch", "/welcome", "/kit", "/terminal", "/api/public/health", "/api/public/mcp", "/_serverFn/abc", "/watch/abc", "/audit", "/library/gopro.com", "/ambient", "/lock"]) expect(isReadPath(p), p).toBe(false);
  });
  it("keys on the path and the page's own parameters only", () => {
    expect(readCacheKey(req("/brands?utm_source=x&sector=fintech&fbclid=1"), false)).toBe("https://slug.global/brands?sector=fintech");
    expect(readCacheKey(req("/?format=move&sector=retail"), false)).toBe(readCacheKey(req("/?sector=retail&format=move"), false));
    expect(readCacheKey(req("/brands/gopro.com"), false)).toBe("https://slug.global/brands/gopro.com");
  });
  it("skips non-GET, Authorization and the password gate", () => {
    expect(readCacheKey(req("/brands", { method: "POST" }), false)).toBeNull();
    expect(readCacheKey(req("/brands", { auth: true }), false)).toBeNull();
    expect(readCacheKey(req("/brands"), true)).toBeNull();
  });
  it("shares only 200 HTML without cookies or a stricter header", () => {
    expect(shareable(html())).toBe(true);
    expect(shareable(html(404))).toBe(false);
    expect(shareable(html(500))).toBe(false);
    expect(shareable(html(503))).toBe(false);
    expect(shareable(html(200, { "set-cookie": "a=b" }))).toBe(false);
    expect(shareable(html(200, { "cache-control": "no-store" }))).toBe(false);
    expect(shareable(html(200, { "cache-control": "private, max-age=60" }))).toBe(false);
    expect(shareable({ status: 200, headers: new Headers({ "content-type": "application/json" }) })).toBe(false);
  });
});
