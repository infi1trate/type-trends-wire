// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("@/lib/library-store.server", () => ({
  librarySite: vi.fn(async () => ({ site: { domain: "openai.com", last_snapshot_at: "2026-11-11T01:00:00Z" }, snapshots: [{ id: 1, page_type: "home", viewport: "desktop", source: "live", captured_at: "2026-11-11T01:00:00Z", url: "https://openai.com", signals: { skeleton: [{ x: 0 }], raw_text: "private", type: { rendered: { h1: { family: "OpenAI Sans" } } } } }], events: Array.from({ length: 25 }, (_, id) => ({ id, type: "theme_flip" })) })),
  libraryEvents: vi.fn(async () => []), librarySector: vi.fn(async () => ({ sector: "ai", top_fonts: { h1: [{ family: "OpenAI Sans", sites: 1 }] } })), currentSpread: vi.fn(async () => [{ signal: "dark_theme", spread_pts: 15.8 }]),
}));
import { handleMcp } from "./server.server";
async function call(name: string, args: Record<string, unknown>) {
  const res = await handleMcp(new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-forwarded-for": "library-tests" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }));
  return (await res.json()).result;
}
it("library_site returns fingerprint, metadata, receipts and at most 20 events without skeleton or raw text", async () => {
  const result = await call("library_site", { domain: "openai.com" }); const data = JSON.parse(result.content[0].text);
  expect(data.fingerprint.h1_family).toBe("OpenAI Sans"); expect(data.events).toHaveLength(20); expect(data.snapshots[0].captured_at).toBe("2026-11-11T01:00:00Z"); expect(data.receipts.method).toBe("trend://methodology"); expect(data.snapshots[0]).not.toHaveProperty("signals"); expect(result.content[0].text).not.toContain("raw_text"); expect(result.content[0].text).not.toContain("skeleton");
});
it("library_events rejects limits above the requested 100", async () => { expect((await call("library_events", { limit: 101 })).isError).toBe(true); expect((await call("library_events", { limit: 100 })).isError).not.toBe(true); });
it("sector and spread tools return their public records", async () => {
  expect(JSON.parse((await call("library_sector", { sector: "ai" })).content[0].text).top_fonts.h1[0]).toEqual({ family: "OpenAI Sans", sites: 1 });
  expect(JSON.parse((await call("crawl_spread", { scope: "en" })).content[0].text).rows[0].spread_pts).toBe(15.8);
});