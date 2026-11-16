// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { embedResponse, embedSnippet, embedSrc, embedTarget, oembedResponse, traitEmbedModel, type EmbedLoaders } from "./embed";
import { handleOembed } from "./oembed.server";
import { OPEN_PATHS, gate, isOpenPath, sha256Hex } from "../gate";
import { createRateLimiter } from "../mcp/rate-limit";
import type { ForecastLike } from "../chart/model";

const quarters = [["2025Q4", 0.05], ["2026Q1", 0.07], ["2026Q2", 0.08], ["2026Q3", 0.1], ["2026Q4", 0.12]].map(([q, s]) => ({ q: q as string, s: s as number, n: 60, c: 0.8 }));
const row: ForecastLike = { dimension: "css", value: "subgrid", scope: "all", stage: "accelerating", current_share: 0.12, momentum: 1.6, quarters, proj_q1: 0.14, proj_q1_lo: 0.125, proj_q1_hi: 0.17, proj_q2: 0.16, proj_q2_lo: 0.13, proj_q2_hi: 0.2, proj_q4: 0.2, proj_q4_lo: 0.15, proj_q4_hi: 0.27, run_id: 13 };
const model = traitEmbedModel("css:subgrid", row, "2026Q4")!;
const loaders: EmbedLoaders = { trait: async k => (k === "css:subgrid" ? model : null), chart: async w => (w === "2026-W46" ? model : null) };
const get = (p: string, cookie?: string) => new Request(`https://site.test${p}`, cookie ? { headers: { cookie } } : {});

describe("embed widget", () => {
  it("renders name [DIMENSION], stage in words, chart with band, the call, data-through and a new-tab credit link", async () => {
    const r = await embedResponse(get("/embed/trait/css%3Asubgrid?theme=light"), { kind: "trait", key: "css:subgrid" }, loaders);
    expect(r.status).toBe(200);
    const html = await r.text();
    expect(html).toContain("Subgrid layouts <span class=\"dim\">[LAYOUT]</span>");
    expect(html).toContain(">Rising</span>");
    expect(html).toContain("Subgrid layouts: rising from 12.0% to 12.5–17.0% of homepages by Q1 2027.");
    expect(html).toContain("Data through Q4 2026");
    // The credit link carries the drawn mark (an inline SVG of the kit's outlined path), never the name set in type.
    expect(html).toMatch(/<a href="https:\/\/slug\.global\/trait\/css%3Asubgrid" target="_blank" rel="noopener" aria-label="slug: the full chart"><svg [^>]*role="img" aria-label="slug"><path [^>]*fill="#0A0A0A"\/><\/svg> →<\/a>/);
    expect(html.match(/<svg [^>]*class="v-/g)!.length).toBe(3);
    expect(html).toContain('stroke="#19B560"');
    expect(html).toMatch(/<main aria-label="Subgrid layouts \[LAYOUT\], MEASURED, all sectors: Rising\./);
    expect(html).toContain("prefers-reduced-motion");
    expect(html).not.toMatch(/<script|\$[A-Z]/);
  });
  it("sends frame-ancestors *, the public cache, noindex and no cookies", async () => {
    const r = await embedResponse(get("/embed/chart/2026-W46"), { kind: "chart", week: "2026-W46" }, loaders);
    expect(r.headers.get("content-security-policy")).toBe("frame-ancestors *");
    expect(r.headers.get("cache-control")).toBe("public, max-age=3600, s-maxage=86400");
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
    expect(r.headers.get("set-cookie")).toBeNull();
  });
  it("unknown key or week → a small readable 'Signal not found' card with HTTP 404", async () => {
    for (const t of [{ kind: "trait" as const, key: "css:nope" }, { kind: "chart" as const, week: "2020-W01" }]) {
      const r = await embedResponse(get("/embed/x"), t, loaders);
      expect(r.status).toBe(404);
      expect(r.headers.get("content-security-policy")).toBe("frame-ancestors *");
      expect(await r.text()).toContain("<h1>Signal not found</h1>");
    }
  });
  it("only /embed/ pages allow framing: no other source sets frame-ancestors", () => {
    const hits: string[] = [];
    const walk = (d: string) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e) && !e.endsWith(".test.ts") && readFileSync(p, "utf8").includes("frame-ancestors")) hits.push(p); } };
    walk("src");
    expect(hits.filter(p => !p.endsWith("routeTree.gen.ts"))).toEqual(["src/lib/embed/embed.ts"]);
  });
  it("snippet: responsive 280–800 px, fixed 4:3, lazy, borderless, titled", () => {
    const src = embedSrc({ kind: "trait", key: "css:subgrid" }, { theme: "light", scope: "fintech" });
    expect(src).toBe("https://slug.global/embed/trait/css%3Asubgrid?scope=fintech&theme=light");
    expect(embedSnippet(src, "Subgrid layouts [LAYOUT]")).toBe('<iframe src="https://slug.global/embed/trait/css%3Asubgrid?scope=fintech&amp;theme=light" title="Subgrid layouts [LAYOUT] — slug signal chart" style="width:100%;max-width:800px;min-width:280px;aspect-ratio:4/3;height:auto;border:0" loading="lazy"></iframe>');
    expect(embedSrc({ kind: "chart", week: "2026-W46" })).toBe("https://slug.global/embed/chart/2026-W46");
  });
});

describe("embed gate", () => {
  it("is open without the site cookie and listed in OPEN_PATHS with its reason; other pages stay gated", async () => {
    const cfg = { hash: await sha256Hex("pw"), allow: createRateLimiter(10, 60000) };
    for (const p of ["/embed/trait/css%3Asubgrid", "/embed/trait/css%3Asubgrid?theme=light&scope=fintech", "/embed/chart/2026-W46", "/api/public/oembed?url=x"]) expect(await gate(get(p), cfg), p).toBeNull();
    for (const p of ["/trait/css%3Asubgrid", "/chart/2026-W46", "/ledger", "/embed"]) expect((await gate(get(p), cfg))!.status, p).toBe(401);
    const e = OPEN_PATHS.find(o => o.prefix === "/embed/")!;
    expect(e.why).toMatch(/embeds render on other sites where no password can be entered/);
    expect(isOpenPath("/embed/trait/x")).toBe(true);
  });
});

describe("oEmbed", () => {
  const ld = { trait: async (k: string) => (k === "css:subgrid" ? { title: "Subgrid layouts [LAYOUT]" } : null), chart: async (w: string) => (w === "2026-W46" ? { title: "Subgrid layouts [LAYOUT]" } : null) };
  const ask = (q: string) => handleOembed(new Request(`https://slug.global/api/public/oembed?${q}`), ld);
  it("returns a valid rich response for trait and chart page URLs", async () => {
    const r = await ask(`url=${encodeURIComponent("https://slug.global/trait/css%3Asubgrid")}&maxwidth=500`);
    expect(r.status).toBe(200);
    const o = await r.json();
    expect(o).toMatchObject({ version: "1.0", type: "rich", provider_name: "slug", provider_url: "https://slug.global", title: "Subgrid layouts [LAYOUT] — slug", width: 500, height: 375, cache_age: 3600 });
    expect(o.html).toBe('<iframe src="https://slug.global/embed/trait/css%3Asubgrid" title="Subgrid layouts [LAYOUT] — slug signal chart" width="500" height="375" style="border:0;max-width:100%" loading="lazy"></iframe>');
    const c = await (await ask(`url=${encodeURIComponent("https://slug.global/chart/2026-W46")}`)).json();
    expect(c).toMatchObject({ type: "rich", width: 800, height: 600 });
    expect(c.html).toContain("/embed/chart/2026-W46");
  });
  it("404s other hosts, other paths and unknown signals; 501 for non-JSON formats", async () => {
    expect((await ask(`url=${encodeURIComponent("https://evil.example/trait/css%3Asubgrid")}`)).status).toBe(404);
    expect((await ask(`url=${encodeURIComponent("https://slug.global/ledger")}`)).status).toBe(404);
    expect((await ask(`url=${encodeURIComponent("https://slug.global/trait/css%3Anope")}`)).status).toBe(404);
    expect((await ask(`url=x&format=xml`)).status).toBe(501);
    expect(oembedResponse("https://x/embed", "T", 100).width).toBe(280);
    expect(embedTarget("/embed/chart/2026-W46")).toEqual({ kind: "chart", week: "2026-W46" });
  });
  it("trait and chart pages advertise the oEmbed endpoint", () => {
    expect(readFileSync("src/lib/digest/meta.ts", "utf8")).toContain("oembedLink(url,");
    expect(readFileSync("src/routes/chart.$week.tsx", "utf8")).toContain("oembedLink(url, loaderData.name)");
  });
});
