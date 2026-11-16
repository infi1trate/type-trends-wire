// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GATE_ENABLED, gate, robotsTxt, sha256Hex, SITE_PASSWORD_SHA256 } from "./gate";
import { createRateLimiter } from "./mcp/rate-limit";

describe("while the gate is on, nothing asks to be indexed", () => {
  it("the gate is on", () => expect(GATE_ENABLED).toBe(true));
  it("robots.txt disallows everything", () => expect(robotsTxt(SITE_PASSWORD_SHA256)).toMatch(/User-agent: \*\s+Disallow: \/\s*$/m));
  it("a locked response carries noindex, nofollow", async () => {
    const r = (await gate(new Request("https://site.test/brands/neon.com"), { hash: await sha256Hex("x"), allow: createRateLimiter(10, 60_000) }))!;
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("every unlocked page's head says noindex (the root head, merged into every route)", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toContain('...(GATE_ENABLED ? [{ name: "robots", content: "noindex" }] : [])');
  });
});
