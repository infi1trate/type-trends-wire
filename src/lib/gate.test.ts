// @vitest-environment node
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./mcp/rate-limit";
import { GATE_COOKIE, OPEN_PATHS, gate, gateToken, isOpenPath, robotsTxt, safeNext, sha256Hex, type GateConfig } from "./gate";

const PW = "test-only-password";
const cfgFor = async (pw = PW, limit = 1000): Promise<GateConfig> => ({ hash: await sha256Hex(pw), allow: createRateLimiter(limit, 600000) });
const get = (path: string, cookie?: string) => new Request(`https://site.test${path}`, { headers: cookie ? { cookie } : {} });
const unlock = (password: string, next = "/", ip = "1.1.1.1") =>
  new Request("https://site.test/unlock", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": ip }, body: new URLSearchParams({ password, next }).toString() });
const cookieOf = (r: Response) => r.headers.get("set-cookie") ?? "";

describe("site gate", () => {
  it("locked page → 401 gate page with no page data or OG meta", async () => {
    const r = (await gate(get("/digest/2026-W46"), await cfgFor()))!;
    expect(r.status).toBe(401);
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(r.headers.get("cache-control")).toBe("no-store");
    const html = await r.text();
    expect(html).toContain("<title>slug</title>");
    expect(html).toContain('<label for="password">Password</label>');
    expect(html).toContain('value="/digest/2026-W46"');
    expect(html).not.toMatch(/og:|twitter:|Subgrid|The Digest No/);
    expect(html).not.toContain("That's not it.");
  });

  it("correct password → cookie + 303 to the preserved path", async () => {
    const cfg = await cfgFor();
    const r = (await gate(unlock(PW, "/trait/css%3Asubgrid?x=1"), cfg))!;
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/trait/css%3Asubgrid?x=1");
    const c = cookieOf(r);
    expect(c).toContain(`${GATE_COOKIE}=${await gateToken(cfg.hash)}`);
    for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) expect(c).toContain(attr);
    expect(await gate(get("/", `${GATE_COOKIE}=${await gateToken(cfg.hash)}`), cfg)).toBeNull();
  });

  it("wrong password → 401 with the inline message", async () => {
    const r = (await gate(unlock("nope", "/library/vercel.com"), await cfgFor()))!;
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie")).toBeNull();
    const html = await r.text();
    expect(html).toContain("That's not it.");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('value="/library/vercel.com"');
  });

  it("open-redirect attempts fall back to /", async () => {
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil.com", ""]) {
      expect(safeNext(bad)).toBe("/");
      const r = (await gate(unlock(PW, bad), await cfgFor()))!;
      expect(r.headers.get("location")).toBe("/");
    }
    expect(safeNext("/digest/archive")).toBe("/digest/archive");
  });

  it("machine endpoints, share images and thumbs are open without a cookie", async () => {
    const cfg = await cfgFor();
    for (const p of ["/api/public/health", "/api/public/mcp", "/api/public/ingest-thumbs", "/api/public/thumb-optout", "/api/public/library-state",
      "/chart/2026-W46.png", "/chart/2026-W46.svg", "/digest/2026-W46.png", "/trait/css%3Asubgrid.png", "/thumbs/vercel.com/2026-11-15-desktop.webp", "/favicon.svg", "/robots.txt"])
      expect(await gate(get(p), cfg), p).toBeNull();
  });

  it("watch and audit pages are gated; the audit share card and per-watchlist feed are open", async () => {
    const cfg = await cfgFor(), id = "A".repeat(22);
    for (const p of [`/watch/${id}`, `/watch/${id}?k=${"B".repeat(22)}`, "/watch/new", "/audit?sites=linear.app,vercel.com", "/audit/new"]) expect((await gate(get(p), cfg))!.status, p).toBe(401);
    for (const p of ["/audit.png?sites=linear.app,vercel.com", `/api/public/watch-feed/${"F".repeat(22)}.xml`]) expect(await gate(get(p), cfg), p).toBeNull();
    const feed = OPEN_PATHS.find(o => o.pattern?.test(`/api/public/watch-feed/${"F".repeat(22)}.xml`))!;
    expect(feed.why).toMatch(/capability URL/);
    expect(feed.pattern!.test("/api/public/watch-feed/short.xml")).toBe(false);
    expect(OPEN_PATHS.find(o => o.exact === "/audit.png")!.why).toMatch(/domain names and capture date only/);
  });

  it("crop images are gated like any page: 401 without the cookie, never the image", async () => {
    const r = (await gate(get("/crops/vercel.com/hero/2026-11-15-abcdef01.webp"), await cfgFor()))!;
    expect(r.status).toBe(401);
    expect(r.headers.get("content-type")).not.toContain("image/");
  });
  it("RSS and server functions answer 401 text when locked", async () => {
    const cfg = await cfgFor();
    for (const p of ["/digest/rss.xml", "/_serverFn/abc"]) {
      const r = (await gate(get(p), cfg))!;
      expect(r.status).toBe(401);
      expect(r.headers.get("content-type")).toContain("text/plain");
    }
  });

  it("throttles /unlock to 10 attempts per IP per 10 minutes → 429", async () => {
    const cfg: GateConfig = { hash: await sha256Hex(PW), allow: createRateLimiter(10, 600000) };
    for (let i = 0; i < 10; i++) expect((await gate(unlock("wrong", "/", "9.9.9.9"), cfg))!.status).toBe(401);
    const r = (await gate(unlock(PW, "/", "9.9.9.9"), cfg))!;
    expect(r.status).toBe(429);
    expect((await gate(unlock(PW, "/", "8.8.8.8"), cfg))!.status).toBe(303);
  });

  it("rejects unlock bodies over 2 KB", async () => {
    const r = (await gate(unlock("x".repeat(3000)), await cfgFor()))!;
    expect(r.status).toBe(413);
  });

  it("empty hash disables the gate and restores open robots", async () => {
    const off: GateConfig = { hash: "", allow: () => true };
    for (const p of ["/", "/digest", "/digest/rss.xml", "/unlock"]) expect(await gate(get(p), off)).toBeNull();
    expect(robotsTxt("")).not.toContain("Disallow");
    expect(robotsTxt("abc")).toBe("User-agent: *\nDisallow: /\n");
  });

  it("changing the hash invalidates old cookies", async () => {
    const oldCookie = `${GATE_COOKIE}=${await gateToken(await sha256Hex(PW))}`;
    const r = (await gate(get("/", oldCookie), await cfgFor("a-different-test-password")))!;
    expect(r.status).toBe(401);
  });

  it("POST /lock clears the cookie and 303s to /", async () => {
    const r = (await gate(new Request("https://site.test/lock", { method: "POST" }), await cfgFor()))!;
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/");
    expect(cookieOf(r)).toContain(`${GATE_COOKIE}=;`);
    expect(cookieOf(r)).toContain("Max-Age=0");
  });

  it("every /api/public route and MCP is open; every page route (and RSS) is gated", () => {
    const dir = join(process.cwd(), "src/routes");
    const files: string[] = [];
    const walk = (d: string, pre = "") => { for (const e of readdirSync(join(dir, d), { withFileTypes: true })) e.isDirectory() ? walk(join(d, e.name), `${pre}${e.name}/`) : files.push(`${pre}${e.name}`); };
    walk("");
    const PARAMS: Record<string, string> = { $date: "2026-11-16", $sector: "fintech", $week: "2026-W46", $key: "css%3Asubgrid", $domain: "vercel.com", $number: "47", $slug: "who-went-big-first", $file: "slug-s.svg", $: "vercel.com/2026-11-15-desktop.webp", index: "" };
    const toPath = (f: string) => "/" + f.replace(/\.tsx?$/, "").replace(/\[\.\]/g, "\u0000").replace(/[{}]/g, "").split(/[./]/)
      .map(seg => seg.split("\u0000").map(part => PARAMS[part] ?? part).join("."))
      .filter(Boolean).join("/");
    const routes = files.filter(f => /\.tsx?$/.test(f) && !f.includes("__root") && !f.endsWith(".test.ts"));
    const api = routes.filter(f => f.startsWith("api/public/"));
    expect(api).toContain("api/public/mcp.ts");
    for (const f of api) expect(isOpenPath(toPath(f)), f).toBe(true);
    const pages = routes.filter(f => f.endsWith(".tsx"));
    expect(pages.length).toBeGreaterThan(5);
    for (const f of pages) expect(isOpenPath(toPath(f)), `${f} → ${toPath(f)}`).toBe(false);
    expect(isOpenPath("/digest/rss.xml")).toBe(false);
    // Any other server route must be a deliberate decision: share images/thumbs/robots open, RSS and crop images gated.
    const otherServer = routes.filter(f => f.endsWith(".ts") && !f.startsWith("api/public/")).map(toPath).sort();
    expect(otherServer.filter(isOpenPath)).toEqual(["/audit.png", "/chart/2026-W46.png", "/chart/2026-W46.svg", "/digest/2026-W46.png", "/embed/chart/2026-W46", "/embed/trait/css%3Asubgrid", "/robots.txt", "/thumbs/vercel.com/2026-11-15-desktop.webp", "/trait/css%3Asubgrid.png"]);
    expect(otherServer.filter(p => !isOpenPath(p))).toEqual(["/brand/files/slug-s.svg", "/crops/vercel.com/2026-11-15-desktop.webp", "/data/embed/who-went-big-first", "/data/who-went-big-first.png", "/digest/rss.xml", "/front.json", "/morning/rss.xml", "/share/vercel.com/2026-11-15-desktop.webp"]);
    // The new share cards stay gated until launch adds /share/ to OPEN_PATHS (listed on /status/launch).
    expect(isOpenPath("/share/brand/neon.com.png")).toBe(false);
    expect(OPEN_PATHS.every(o => o.why.length > 10)).toBe(true);
  });

  it("the landing page stays private: LANDING_PUBLIC is false, /welcome is gated and not in OPEN_PATHS", async () => {
    const { LANDING_PUBLIC } = await import("./site");
    expect(LANDING_PUBLIC).toBe(false);
    expect(isOpenPath("/welcome")).toBe(false);
    expect(OPEN_PATHS.some(o => JSON.stringify(o).includes("welcome"))).toBe(false);
    for (const p of ["/morning", "/morning/2026-11-16", "/morning/rss.xml", "/sectors", "/sectors/fintech", "/editions"]) expect(isOpenPath(p), p).toBe(false);
  });

  it("data stories stay private: DATA_STORIES_PUBLIC is false; pages, share images and embeds are gated and not in OPEN_PATHS", async () => {
    const { DATA_STORIES_PUBLIC } = await import("./site");
    expect(DATA_STORIES_PUBLIC).toBe(false);
    for (const p of ["/data", "/data/who-went-big-first", "/data/who-went-big-first?step=3", "/data/where-you-sit", "/data/who-went-big-first.png", "/data/who-went-big-first.svg", "/data/embed/who-went-big-first"]) expect(isOpenPath(p), p).toBe(false);
    expect(OPEN_PATHS.some(o => JSON.stringify(o).includes("/data"))).toBe(false);
  });

  it("the brand pages stay private: BRAND_PUBLIC is false; every brand page and kit file is gated and not in OPEN_PATHS", async () => {
    const { BRAND_PUBLIC } = await import("./site");
    expect(BRAND_PUBLIC).toBe(false);
    for (const p of ["/brand", "/brand/mark", "/brand/colour", "/brand/type", "/brand/containers", "/brand/space", "/brand/illustration", "/brand/motion", "/brand/downloads",
      "/brand/files/slug-wordmark-display.svg", "/brand/files/slug-app-icon-1024.png", "/brand/files/slug.tokens.json", "/brand/files/README.md"]) expect(isOpenPath(p), p).toBe(false);
    expect(OPEN_PATHS.some(o => JSON.stringify(o).includes("brand"))).toBe(false);
    const cfg = { hash: "a".repeat(64), allow: () => true };
    for (const p of ["/brand", "/brand/files/slug-s.svg"]) expect((await gate(new Request(`https://slug.global${p}`), cfg))?.status, p).toBe(401);
  });
});
