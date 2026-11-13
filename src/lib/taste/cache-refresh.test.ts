// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ calls: [] as unknown[][] }));
const chain = vi.hoisted(() => (table: string, data: unknown = []) => {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "is", "order", "range", "limit", "delete", "upsert", "gt", "overlaps"]) c[m] = (...a: unknown[]) => { mock.calls.push([table, m, ...a]); return c; };
  c["maybeSingle"] = async () => ({ data: null, error: null });
  c["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error: null, count: 2 }).then(resolve);
  return c;
});
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: async (name: string) => { mock.calls.push(["rpc", name]); return { error: null }; }, from: (t: string) => chain(t) } }));
vi.mock("../mcp/supabase", () => ({ supabaseAnon: () => ({ from: (t: string) => chain(t) }) }));
vi.mock("./store.server", async (orig) => ({ ...(await orig<typeof import("./store.server")>()), loadTasteSites: async () => [] }));
import { TASTE_DATA_NAMESPACES, cached, invalidateTasteCache } from "./cache.server";
import { refreshTaste } from "./refresh.server";

beforeEach(() => { mock.calls = []; });
describe("cache invalidation", () => {
  it("stores namespace and tags with each cached response", async () => {
    await cached("critique", { url: "https://a.com" }, async () => ({ ok: true }), { tags: ["a.com/"] });
    const upsert = mock.calls.find(c => c[1] === "upsert")?.[2] as Record<string, unknown>;
    expect(upsert).toMatchObject({ namespace: "critique", tags: ["a.com/"] });
  });
  it("clears every data-dependent namespace plus legacy untagged rows, keeping brief parsing", async () => {
    await invalidateTasteCache();
    expect(mock.calls).toContainEqual(["tool_cache", "in", "namespace", TASTE_DATA_NAMESPACES]);
    expect(mock.calls).toContainEqual(["tool_cache", "is", "namespace", null]);
    expect(TASTE_DATA_NAMESPACES).toEqual(expect.arrayContaining(["taste-data", "recommend_type", "recommend_palette", "differentiate", "critique"]));
    expect(TASTE_DATA_NAMESPACES).not.toContain("brief-parse");
  });
  it("runs at the end of the weekly refresh, after the new summaries are written", async () => {
    const result = await refreshTaste();
    const rpc = mock.calls.findIndex(c => c[0] === "rpc" && c[1] === "replace_taste_data");
    const clear = mock.calls.findIndex(c => c[0] === "tool_cache" && c[1] === "in" && c[2] === "namespace");
    expect(rpc).toBeGreaterThanOrEqual(0);
    expect(clear).toBeGreaterThan(rpc);
    expect(result.cache_cleared).toBe(4);
  });
});
