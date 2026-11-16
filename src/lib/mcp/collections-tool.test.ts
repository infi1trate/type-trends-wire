// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { similarBrands } from "@/lib/similar";

const tile = (k: number) => ({ id: String(k), snapshot: k, domain: "ramp.com", name: "Ramp", sector: "fintech", at: "2026-11-15T00:00:00Z", day: "15 Nov 2026", quarter: "2026Q4", source: "live", label: "ramp.com, first screen, 15 Nov 2026", href: "/brands/ramp.com", size: "sm", crop: null, note: null, frame: null });
vi.mock("@/lib/gallery.server", () => ({
  loadCollections: async () => [
    { slug: "who-went-big", number: 2, title: "Who went big", deck: "D", pairs: { label: "Data story 2", href: "/data/who-went-big-first" }, status: "live", reason: null, count: 269, href: "/collections/who-went-big" },
    { slug: "draft-one", number: 9, title: "Draft", deck: "D", pairs: { label: "x", href: "/signals" }, status: "draft", reason: "5 captures match its filter so far; a collection needs at least 12.", count: 5, href: null },
  ],
  loadCollection: async (slug: string) => slug === "who-went-big"
    ? { kind: "live", slug, number: 2, title: "Who went big", deck: "D", pairs: { label: "Data story 2", href: "/data/who-went-big-first" }, gallery: { total: 269, tiles: Array.from({ length: 48 }, (_, k) => tile(k + 1)) } }
    : { kind: "missing" },
}));
vi.mock("@/lib/library-store.server", () => ({
  librarySite: async (d: string) => (d === "neon.com" ? { site: { domain: "neon.com", last_snapshot_at: "2026-11-16T00:00:00Z" }, snapshots: [], events: [] } : null),
}));
vi.mock("@/lib/read.server", () => ({
  similarFor: async (d: string) => similarBrands(d, [
    { domain: "neon.com", name: "Neon", sector: "dev-tools", traits: ["a", "b"] }, { domain: "supabase.com", name: "Supabase", sector: "dev-tools", traits: ["a", "b"] },
  ], new Set(["a", "b"])),
}));
import { handleMcp } from "./server.server";
const req = (name: string, args: unknown) => new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": "10.9.9.8" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) });
const call = async (name: string, args: unknown) => (await (await handleMcp(req(name, args))).json()).result;

describe("MCP collections", () => {
  it("lists collections with status, count and absolute urls", async () => {
    const out = JSON.parse((await call("collections", {})).content[0].text);
    expect(out.collections[0]).toMatchObject({ number: 2, slug: "who-went-big", status: "live", count: 269, url: "https://slug.global/collections/who-went-big", pairs_with: { url: "https://slug.global/data/who-went-big-first" } });
    expect(out.collections[1]).toMatchObject({ status: "draft", draft_reason: expect.stringContaining("at least 12") });
  });
  it("one collection: title, deck, the filter, the count and the first tiles as text with urls", async () => {
    const out = JSON.parse((await call("collections", { slug: "who-went-big" })).content[0].text);
    expect(out).toMatchObject({ title: "Who went big", status: "live", count: 269 });
    expect(out.filter.pattern).toBe("combo:big_type");
    expect(out.tiles).toHaveLength(12);
    expect(out.tiles[0]).toMatchObject({ text: "ramp.com, first screen, 15 Nov 2026", url: "https://slug.global/brands/ramp.com", picture: "redrawn from stored layout" });
    expect((await call("collections", { slug: "no-such-one" })).isError).toBe(true);
  });
});
describe("MCP library_site similar", () => {
  it("adds the similar brands with the signals they share", async () => {
    const out = JSON.parse((await call("library_site", { domain: "neon.com" })).content[0].text);
    expect(out.similar.brands).toHaveLength(1);
    expect(out.similar.brands[0]).toMatchObject({ domain: "supabase.com", name: "Supabase", sector: "dev-tools", same_sector: true, overlap: 1, shared: ["a", "b"], url: "https://slug.global/brands/supabase.com" });
    expect(out.similar.enough).toBe(false);
  });
});
