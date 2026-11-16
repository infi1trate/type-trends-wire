// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("./store.server", () => ({ latestFontDate: vi.fn(async () => "2026-11-10"), fontHistory: vi.fn(async () => []), fontSnapshot: vi.fn(async () => ({ date: "2026-11-10", rows: [] })), familySuggestions: vi.fn(async () => []), wire: vi.fn(async () => []) }));
import { generateKey, keyHash, KEY_RE, parseAuthorization, createKeyedLimiter, usageTool } from "./keys";
import { createKeyResolver, handleKeyAdmin, type KeyRow, type KeyStore, type AdminDeps } from "./keys.server";
import { handleMcp, TOOL_NAMES, type McpDeps } from "./server.server";
import { createRateLimiter } from "./rate-limit";

function memStore() {
  const rows: KeyRow[] = [], usage = new Map<string, number>(); let n = 0;
  const store: KeyStore = {
    byHash: async h => rows.find(r => r.key_sha256 === h) ?? null,
    insert: async r => { const row = { ...r, id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, created_at: "2026-11-15T00:00:00Z", revoked_at: null, last_used_at: null }; rows.push(row); return { id: row.id, created_at: row.created_at }; },
    revoke: async (id, at) => { const r = rows.find(x => x.id === id); if (!r) return "missing"; if (r.revoked_at) return "already"; r.revoked_at = at; return "revoked"; },
    list: async () => rows,
    usageSince: async () => [...usage].map(([k, calls]) => ({ key_id: k.split("|")[0]!, calls })),
    count: async (id, tool) => { const k = `${id}|2026-11-15|${tool}`; usage.set(k, (usage.get(k) ?? 0) + 1); },
  };
  return { store, rows, usage };
}
const admin = (m: ReturnType<typeof memStore>, authorized = true, onAuth?: () => void): AdminDeps => ({ authorize: async () => { onAuth?.(); return authorized; }, store: m.store, now: () => new Date("2026-11-15T12:00:00Z") });
const post = (body: unknown) => new Request("https://site.test/api/public/mcp-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const mcpDeps = (m: ReturnType<typeof memStore>): McpDeps => ({ resolve: createKeyResolver(async () => m.store, 0), count: m.store.count, anon: createRateLimiter(), keyed: createKeyedLimiter() });
const ping = (ip: string, key?: string) => new Request("http://localhost/api/public/mcp", { headers: { "x-forwarded-for": ip, ...(key ? { authorization: `Bearer ${key}` } : {}) } });
const call = (ip: string, key: string | undefined, name: string) => new Request("http://localhost/api/public/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-06-18", "x-forwarded-for": ip, ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: { family: "Inter" } } }) });

describe("MCP keys", () => {
  it("dsgn_ + 32 base62, random each time", () => {
    const a = generateKey(), b = generateKey();
    expect(a).toMatch(KEY_RE); expect(a).not.toBe(b);
    expect(parseAuthorization(null)).toEqual({ kind: "none" });
    expect(parseAuthorization(`Bearer ${a}`)).toEqual({ kind: "key", key: a });
    expect(parseAuthorization("Bearer sk-nope")).toEqual({ kind: "invalid" });
  });
  it("create returns the plaintext once and stores only its SHA-256 and prefix", async () => {
    const m = memStore();
    const r = await handleKeyAdmin(post({ action: "create", name: "Acme agency", note: "pilot" }), admin(m));
    expect(r.status).toBe(201);
    const out = await r.json();
    expect(out.key).toMatch(KEY_RE); expect(out.prefix).toBe(out.key.slice(0, 8)); expect(out.rate_per_min).toBe(600);
    expect(m.rows[0]!.key_sha256).toBe(await keyHash(out.key));
    expect(JSON.stringify(m.rows)).not.toContain(out.key);
    const list = await (await handleKeyAdmin(post({ action: "list" }), admin(m))).json();
    expect(JSON.stringify(list)).not.toContain(out.key);
    expect(JSON.stringify(list)).not.toContain(m.rows[0]!.key_sha256);
    expect(Object.keys(list.keys[0]).sort()).toEqual(["calls_30d", "created_at", "id", "last_used_at", "name", "note", "prefix", "rate_per_min", "revoked_at"]);
  });
  it("admin endpoint authenticates before reading the body", async () => {
    const m = memStore(); let readBefore = false;
    const req = post({ action: "list" });
    Object.defineProperty(req, "body", { get() { readBefore = true; return new Request("https://x", { method: "POST", body: "{}" }).body; } });
    const r = await handleKeyAdmin(req, admin(m, false, () => { expect(readBefore).toBe(false); }));
    expect(r.status).toBe(401); expect(readBefore).toBe(false);
    expect((await handleKeyAdmin(post({ action: "create", name: "" }), admin(m))).status).toBe(400);
    expect((await handleKeyAdmin(new Request("https://x", { method: "POST", body: "x".repeat(5000) }), admin(m))).status).toBe(413);
  });
  it("a valid key raises the limit (per key, not per IP); anonymous stays at 60/min per IP", async () => {
    const m = memStore(), d = mcpDeps(m);
    const { key } = await (await handleKeyAdmin(post({ action: "create", name: "Fast", rate_per_min: 100 }), admin(m))).json();
    for (let i = 0; i < 60; i++) expect((await handleMcp(ping("1.1.1.1"), d)).status).toBe(200);
    expect((await handleMcp(ping("1.1.1.1"), d)).status).toBe(429);
    for (let i = 0; i < 100; i++) expect((await handleMcp(ping(`ip-${i % 3}`, key), d)).status, String(i)).toBe(200);
    expect((await handleMcp(ping("9.9.9.9", key), d)).status).toBe(429); // the key's own bucket, whatever the IP
    expect((await handleMcp(ping("2.2.2.2"), d)).status).toBe(200);
  });
  it("revoked or unknown keys → 401 JSON-RPC error with no detail", async () => {
    const m = memStore(), d = mcpDeps(m);
    const { key, id } = await (await handleKeyAdmin(post({ action: "create", name: "Gone" }), admin(m))).json();
    expect((await handleMcp(ping("3.3.3.3", key), d)).status).toBe(200);
    await handleKeyAdmin(post({ action: "revoke", id }), admin(m));
    for (const k of [key, generateKey(), "nope"]) {
      const r = await handleMcp(ping("3.3.3.3", k), d);
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized" }, id: null });
    }
    expect((await handleKeyAdmin(post({ action: "revoke", id: "00000000-0000-4000-8000-999999999999" }), admin(m))).status).toBe(404);
  });
  it("counts usage per key, day and tool (aggregate only) and reports 30-day calls in list", async () => {
    const m = memStore(), d = mcpDeps(m);
    const { key, id } = await (await handleKeyAdmin(post({ action: "create", name: "Counted" }), admin(m))).json();
    await handleMcp(call("4.4.4.4", key, "get_trend"), d); await handleMcp(call("4.4.4.4", key, "get_trend"), d); await handleMcp(call("4.4.4.4", key, "not_a_tool"), d);
    await handleMcp(call("4.4.4.4", undefined, "get_trend"), d);
    expect([...m.usage]).toEqual([[`${id}|2026-11-15|get_trend`, 2], [`${id}|2026-11-15|other`, 1]]);
    const list = await (await handleKeyAdmin(post({ action: "list" }), admin(m))).json();
    expect(list.keys[0].calls_30d).toBe(3);
    expect(usageTool("tools/call", "forecast_ledger", new Set(TOOL_NAMES), "POST")).toBe("forecast_ledger");
    expect(usageTool("evil/" + "x".repeat(80), null, new Set(), "POST")).toBe("other");
  });
});
