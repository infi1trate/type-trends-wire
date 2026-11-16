// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { auditModel } from "@/lib/agency/audit";
import { auditFixture, feedRows } from "@/lib/agency/test-fixtures";
import { watchItems, sinceFor } from "@/lib/agency/watch-feed";

const FEED = "F".repeat(22);
vi.mock("@/lib/agency/audit.server", () => ({ loadAudit: vi.fn(async () => auditModel(auditFixture())) }));
vi.mock("@/lib/agency/watch.server", () => ({
  prodDeps: vi.fn(async () => ({})),
  feedItems: vi.fn(async (t: string) => (t === FEED ? { name: "Acme & co", page_url: "https://type-trends-wire.lovable.app/watch/x", items: watchItems(feedRows(), sinceFor("2026-11-15T18:00:00Z", "30d")) } : null)),
}));
import { handleMcp } from "./server.server";
const call = async (name: string, args: unknown, ip = "agency-test") => {
  const res = await handleMcp(new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": ip }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }));
  return (await res.json()).result as { content: { text: string }[]; isError?: boolean };
};

describe("MCP audit_sites", () => {
  it("returns the audit sections with stable keys, labels, dimensions, explainer URLs and the gated audit URL", async () => {
    const r = await call("audit_sites", { domains: ["linear.app", "vercel.com", "supabase.com", "newco.io"] });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0]!.text);
    expect(out.audit_url).toBe("https://type-trends-wire.lovable.app/audit?sites=linear.app,newco.io,supabase.com,vercel.com");
    expect(out.sections).toEqual(["glance", "type", "color", "layout", "vibe", "market", "moves", "whitespace", "method"]);
    expect(out.pending).toEqual(["newco.io"]);
    expect(out.white_space.traits[0]).toMatchObject({ trait: "components:pricing_table", label: "Pricing tables", dimension: "LAYOUT", explainer_url: "https://type-trends-wire.lovable.app/signals/components%3Apricing_table" });
    expect(out.market.sites[0].ahead[0]).toMatchObject({ trait: expect.any(String), label: expect.any(String), dimension: expect.any(String), explainer_url: expect.stringMatching(/^https:\/\/.+\/signals\//) });
    expect(out.layout.components.rows[0]).toMatchObject({ trait: "components:logo_wall", label: expect.any(String), explainer_url: expect.any(String) });
    expect(out.vibe.ai_estimate).toBe(true);
    expect(r.content[0]!.text).not.toMatch(/\$[A-Z][A-Z0-9-]+/);
  });
  it("validates 2–6 domains", async () => {
    expect((await call("audit_sites", { domains: ["linear.app"] })).isError).toBe(true);
    expect((await call("audit_sites", { domains: Array.from({ length: 7 }, (_, i) => `s${i}.com`) })).isError).toBe(true);
    expect((await call("audit_sites", { domains: ["linear.app", "not a domain!"] })).isError).toBe(true);
  });
});

describe("MCP watchlist_changes", () => {
  it("returns the feed's items with labels for trait items", async () => {
    const r = await call("watchlist_changes", { feed_token: FEED });
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.content[0]!.text);
    expect(out.watchlist).toBe("Acme & co");
    expect(out.items.length).toBeLessThanOrEqual(50);
    const stage = out.items.find((i: { guid: string }) => i.guid === "stage-9-all-css:subgrid");
    expect(stage).toMatchObject({ kind: "stage", trait: "css:subgrid", label: "Subgrid layouts", dimension: "LAYOUT", explainer_url: "https://type-trends-wire.lovable.app/signals/css%3Asubgrid" });
    expect(out.items[0].link).toMatch(/#c-/);
  });
  it("rejects malformed and unknown tokens", async () => {
    expect((await call("watchlist_changes", { feed_token: "short" })).isError).toBe(true);
    const r = await call("watchlist_changes", { feed_token: "Z".repeat(22) });
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("Unknown feed token");
  });
});
