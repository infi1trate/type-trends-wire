// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GATE_ENABLED, gate, robotsTxt, sha256Hex, SITE_PASSWORD_SHA256 } from "./gate";
import { createRateLimiter } from "./mcp/rate-limit";

describe("indexing follows the gate switch", () => {
  it("the gate is off (owner removed the password, 17 Nov 2026)", () => expect(GATE_ENABLED).toBe(false));
  it("robots.txt opens while the gate is off", () => expect(robotsTxt(SITE_PASSWORD_SHA256)).not.toMatch(/User-agent: \*\s+Disallow: \/\s*$/m));
  it("robots.txt disallows everything whenever a password is set", () => expect(robotsTxt("x")).toMatch(/User-agent: \*\s+Disallow: \/\s*$/m));
  it("with the gate off, pages pass straight through", async () => expect(await gate(new Request("https://site.test/brands/neon.com"))).toBeNull());
  it("a locked response carries noindex, nofollow", async () => {
    const r = (await gate(new Request("https://site.test/brands/neon.com"), { hash: await sha256Hex("x"), allow: createRateLimiter(10, 60_000) }))!;
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("every unlocked page's head says noindex (the root head, merged into every route)", () => {
    expect(readFileSync("src/routes/__root.tsx", "utf8")).toContain('...(GATE_ENABLED ? [{ name: "robots", content: "noindex" }] : [])');
  });
});
