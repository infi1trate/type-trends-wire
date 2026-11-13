// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], calls: [] as unknown[][], lite: vi.fn() }));
vi.mock("./lite.server", () => ({ liteAnalysis: mock.lite }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "update", "delete", "in", "overlaps", "is"]) chain[m] = (...a: unknown[]) => { mock.calls.push([table, m, ...a]); return chain; };
  chain["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: table === "crawl_requests" ? mock.rows : [], error: null, count: 0 }).then(resolve);
  return chain;
} } }));
import { analyzeUrl, crawlStates } from "./tools.server";

const now = Date.parse("2026-11-13T12:00:00Z"), day = 864e5;
const signals = { type: { rendered: { h1: { family: "Söhne" }, body: { family: "Inter" } } }, color: { page_bg: "#ffffff", accent: "#ff4f00", palette: [{ hex: "#111111" }] }, tech: {}, lexicon: { h1: "Make it" } };
const data = { sites: [] } as unknown as Parameters<typeof analyzeUrl>[1];
beforeEach(() => { mock.rows = []; mock.calls = []; mock.lite.mockReset(); mock.lite.mockResolvedValue({ domain: "studio.com", mode: "lite", traits: [], note: "LITE" }); });

describe("rendered mode", () => {
  it("builds the site from crawler signals instead of LITE and does not re-queue", async () => {
    mock.rows = [{ url: "https://studio.com/", status: "done", signals, rendered_at: new Date(now - 3 * day).toISOString() }];
    const [state] = await crawlStates(["https://www.studio.com"], now);
    const site = await analyzeUrl("https://www.studio.com", data, state);
    expect(site.mode).toBe("rendered");
    expect(site.note).toBe("Rendered by the crawler on 2026-11-10");
    expect(site.h1).toBe("Söhne"); expect(site.bg).toBe("#ffffff"); expect(site.accent).toBe("#ff4f00");
    expect(mock.lite).not.toHaveBeenCalled();
    expect(mock.calls.some(c => c[1] === "update")).toBe(false);
  });
  it("uses LITE with the queued note while pending", async () => {
    mock.rows = [{ url: "https://studio.com/", status: "pending", signals: null, rendered_at: null }];
    const [state] = await crawlStates(["https://studio.com/"], now);
    const site = await analyzeUrl("https://studio.com/", data, state);
    expect(mock.lite).toHaveBeenCalledOnce();
    expect(site.note).toContain("queued — rendered result usually within ~2 hours");
  });
  it("re-queues a rendered result older than 30 days and drops its cached responses", async () => {
    mock.rows = [{ url: "https://studio.com/", status: "done", signals, rendered_at: new Date(now - 31 * day).toISOString() }];
    const [state] = await crawlStates(["https://studio.com/"], now);
    expect(state?.state).toBe("pending");
    expect(mock.calls).toContainEqual(["crawl_requests", "update", { status: "pending", attempts: 0, last_error: null, done_at: null }]);
    expect(mock.calls).toContainEqual(["crawl_requests", "eq", "status", "done"]);
    expect(mock.calls).toContainEqual(["tool_cache", "overlaps", "tags", ["studio.com/"]]);
    await analyzeUrl("https://studio.com/", data, state);
    expect(mock.lite).toHaveBeenCalledOnce();
  });
});
