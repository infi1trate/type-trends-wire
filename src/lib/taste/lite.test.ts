// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ upserts: [] as Record<string, unknown>[], existing: [] as { url: string }[], pending: 0 as number | null, lastDay: 0 as number | null }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: (table: string) => ({
  upsert: async (row: Record<string, unknown>) => { mock.upserts.push({ table, ...row }); return { error: null }; },
  select: (_cols: string, opts?: { head?: boolean }) => {
    if (!opts?.head) return { eq: () => ({ limit: async () => ({ data: mock.existing, error: null }) }) };
    return { eq: async () => ({ count: mock.pending, error: null }), gte: async () => ({ count: mock.lastDay, error: null }) };
  },
}) } }));
import { LITE_UNAVAILABLE, LiteUnavailableError, liteAnalysis, pinnedRequest, pinnedTransportSupported } from "./lite.server";
import { PUBLIC_QUEUE_FULL, PUBLIC_QUEUE_MAX_PENDING, PUBLIC_QUEUE_MAX_PER_DAY, publicQueueAllowed } from "../crawl-requests";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); mock.upserts = []; mock.existing = []; mock.pending = 0; mock.lastDay = 0; });

describe("public render queue caps", () => {
  it("allows below both caps and refuses at either cap or on unreadable counts", () => {
    expect(publicQueueAllowed(0, 0)).toBe(true);
    expect(publicQueueAllowed(PUBLIC_QUEUE_MAX_PENDING - 1, PUBLIC_QUEUE_MAX_PER_DAY - 1)).toBe(true);
    expect(publicQueueAllowed(PUBLIC_QUEUE_MAX_PENDING, 0)).toBe(false);
    expect(publicQueueAllowed(0, PUBLIC_QUEUE_MAX_PER_DAY)).toBe(false);
    expect(publicQueueAllowed(null, 0)).toBe(false);
  });
  it("refuses a new URL when the queue is full and writes nothing", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    mock.pending = PUBLIC_QUEUE_MAX_PENDING;
    await expect(liteAnalysis("https://another-studio.example.org/")).rejects.toThrow(PUBLIC_QUEUE_FULL);
    expect(mock.upserts).toEqual([]);
  });
  it("still answers for a URL that is already queued when the queue is full", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    mock.pending = PUBLIC_QUEUE_MAX_PENDING; mock.lastDay = PUBLIC_QUEUE_MAX_PER_DAY;
    mock.existing = [{ url: "https://queued.example.org/" }];
    await expect(liteAnalysis("https://queued.example.org/")).rejects.toThrow(LITE_UNAVAILABLE);
  });
});

describe("LITE hosted fail-closed", () => {
  it("detects workerd as unsupported for pinned transport", () => {
    expect(pinnedTransportSupported({ navigator: { userAgent: "Cloudflare-Workers" }, process: { versions: { node: "22" } } } as unknown as typeof globalThis)).toBe(false);
    expect(pinnedTransportSupported({ WebSocketPair: class {}, process: { versions: { node: "22" } } } as unknown as typeof globalThis)).toBe(false);
    expect(pinnedTransportSupported({ process: { versions: { node: "22" } } } as unknown as typeof globalThis)).toBe(true);
  });
  it("throws the clear tool error, queues the URL and makes no network request on workerd", async () => {
    vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(liteAnalysis("https://unknown-studio.example.org/work")).rejects.toThrow(LITE_UNAVAILABLE);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mock.upserts).toEqual([{ table: "crawl_requests", url: "https://unknown-studio.example.org/work", domain: "unknown-studio.example.org", status: "pending" }]);
  });
  it("destroys the request without sending it when the transport ignores the pinned lookup", async () => {
    const end = vi.fn(), destroy = vi.fn();
    const transport = { request: () => ({ on: () => undefined, end, destroy }) };
    await expect(pinnedRequest(new URL("https://example.org/"), "93.184.216.34", new AbortController().signal, 1024, transport, 20)).rejects.toBeInstanceOf(LiteUnavailableError);
    expect(end).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });
  it("sends the request only after the transport resolves through the pinned address", async () => {
    let addressSeen = "";
    const end = vi.fn();
    const transport = { request: (_u: URL, options: Record<string, unknown>, onResponse: (r: { statusCode: number; headers: Record<string, string>; on: (e: string, cb: (c?: never) => void) => void }) => void) => {
      (options["lookup"] as (h: string, o: unknown, cb: (e: null, a: string, f: number) => void) => void)("example.org", {}, (_e, a) => { addressSeen = a; });
      return { on: () => undefined, destroy: vi.fn(), end: () => { end(); onResponse({ statusCode: 200, headers: {}, on: (e, cb) => { if (e === "data") cb(new TextEncoder().encode("ok") as never); if (e === "end") cb(); } }); } };
    } };
    const r = await pinnedRequest(new URL("https://example.org/"), "93.184.216.34", new AbortController().signal, 1024, transport, 20);
    expect(addressSeen).toBe("93.184.216.34"); expect(end).toHaveBeenCalledOnce(); expect(r).toMatchObject({ status: 200, text: "ok" });
  });
});
