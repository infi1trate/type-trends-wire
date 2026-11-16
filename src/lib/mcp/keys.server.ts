// MCP key lookup for the endpoint and the owner-only admin API. Stores are injectable so tests run in memory.
import { safeEqual } from "../gate";
import { adminBody, generateKey, keyHash, keyPrefix, parseAuthorization, ADMIN_BODY_LIMIT, DEFAULT_KEY_RATE } from "./keys";
export type KeyRow = { id: string; name: string; key_sha256: string; prefix: string; created_at: string; revoked_at: string | null; last_used_at: string | null; rate_per_min: number; note: string | null };
export type KeyStore = {
  byHash: (hash: string) => Promise<Pick<KeyRow, "id" | "key_sha256" | "rate_per_min" | "revoked_at"> | null>;
  insert: (r: Omit<KeyRow, "id" | "created_at" | "revoked_at" | "last_used_at">) => Promise<{ id: string; created_at: string }>;
  revoke: (id: string, at: string) => Promise<"revoked" | "already" | "missing">;
  list: () => Promise<KeyRow[]>;
  usageSince: (day: string) => Promise<{ key_id: string; calls: number }[]>;
  count: (id: string, tool: string) => Promise<void>;
};
export type Caller = { kind: "anon" } | { kind: "key"; id: string; rate: number } | { kind: "denied" };

/** Resolve the caller from the Authorization header. Lookup is by SHA-256 (never the key); results cached ~30 s. */
export function createKeyResolver(store: () => Promise<KeyStore>, ttlMs = 30000) {
  const cache = new Map<string, { at: number; v: Caller }>();
  return async (header: string | null, now = Date.now()): Promise<Caller> => {
    const a = parseAuthorization(header);
    if (a.kind === "none") return { kind: "anon" };
    if (a.kind === "invalid") return { kind: "denied" };
    const hash = await keyHash(a.key), hit = cache.get(hash);
    if (hit && now - hit.at < ttlMs) return hit.v;
    const row = await (await store()).byHash(hash);
    const v: Caller = row && !row.revoked_at && safeEqual(row.key_sha256, hash) ? { kind: "key", id: row.id, rate: row.rate_per_min } : { kind: "denied" };
    if (cache.size >= 1000) cache.clear();
    cache.set(hash, { at: now, v });
    return v;
  };
}

async function bounded(request: Request, limit: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) return null;
  const reader = request.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel().catch(() => {}); return null; } chunks.push(value); }
  const all = new Uint8Array(size); let o = 0; for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(all);
}
const NO_STORE = { "cache-control": "no-store" };
const j = (status: number, body: unknown) => Response.json(body, { status, headers: NO_STORE });
export type AdminDeps = { authorize: (r: Request) => Promise<boolean>; store: KeyStore; now: () => Date };

/** POST /api/public/mcp-keys — crawler-secret auth BEFORE the body is read; list never returns hashes. */
export async function handleKeyAdmin(request: Request, deps?: AdminDeps): Promise<Response> {
  if (request.method !== "POST") return j(405, { error: "method_not_allowed" });
  const d = deps ?? await prodAdminDeps();
  if (!(await d.authorize(request))) return j(401, { error: "unauthorized" });
  const text = await bounded(request, ADMIN_BODY_LIMIT);
  if (text === null) return j(413, { error: "body_too_large" });
  let raw: unknown; try { raw = JSON.parse(text); } catch { return j(400, { error: "invalid_json" }); }
  const p = adminBody.safeParse(raw); if (!p.success) return j(400, { error: "invalid_input" });
  const b = p.data;
  if (b.action === "create") {
    const key = generateKey(), rate = b.rate_per_min ?? DEFAULT_KEY_RATE;
    const r = await d.store.insert({ name: b.name, key_sha256: await keyHash(key), prefix: keyPrefix(key), rate_per_min: rate, note: b.note ?? null });
    return j(201, { id: r.id, name: b.name, prefix: keyPrefix(key), rate_per_min: rate, created_at: r.created_at, key, shown_once: "Store this key now. Only its SHA-256 is kept; it cannot be shown again." });
  }
  if (b.action === "revoke") {
    const r = await d.store.revoke(b.id, d.now().toISOString());
    return r === "missing" ? j(404, { error: "not_found" }) : j(200, { id: b.id, revoked: true, already: r === "already" });
  }
  const since = new Date(d.now().getTime() - 29 * 864e5).toISOString().slice(0, 10);
  const [keys, usage] = await Promise.all([d.store.list(), d.store.usageSince(since)]);
  const calls = new Map<string, number>(); for (const u of usage) calls.set(u.key_id, (calls.get(u.key_id) ?? 0) + u.calls);
  return j(200, { keys: keys.map(k => ({ id: k.id, name: k.name, prefix: k.prefix, created_at: k.created_at, last_used_at: k.last_used_at, revoked_at: k.revoked_at, rate_per_min: k.rate_per_min, note: k.note, calls_30d: calls.get(k.id) ?? 0 })) });
}

/** Service-role store; only loaded inside handlers. */
export async function adminKeyStore(): Promise<KeyStore> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  return {
    byHash: async hash => { const { data, error } = await db.from("mcp_keys").select("id,key_sha256,rate_per_min,revoked_at").eq("key_sha256", hash).maybeSingle(); if (error) throw error; return data; },
    insert: async r => { const { data, error } = await db.from("mcp_keys").insert(r).select("id,created_at").single(); if (error) throw error; return data; },
    revoke: async (id, at) => {
      const { data, error } = await db.from("mcp_keys").select("revoked_at").eq("id", id).maybeSingle(); if (error) throw error;
      if (!data) return "missing"; if (data.revoked_at) return "already";
      const up = await db.from("mcp_keys").update({ revoked_at: at }).eq("id", id).is("revoked_at", null); if (up.error) throw up.error; return "revoked";
    },
    list: async () => { const { data, error } = await db.from("mcp_keys").select("id,name,key_sha256,prefix,created_at,revoked_at,last_used_at,rate_per_min,note").order("created_at").limit(500); if (error) throw error; return data ?? []; },
    usageSince: async day => { const { data, error } = await db.from("mcp_key_usage").select("key_id,calls").gte("day", day).limit(20000); if (error) throw error; return data ?? []; },
    count: async (id, tool) => { const { error } = await db.rpc("mcp_key_count", { p_key: id, p_tool: tool }); if (error) throw error; },
  };
}
async function prodAdminDeps(): Promise<AdminDeps> {
  const { authenticateQueueCaller } = await import("../crawl-requests.server");
  return { authorize: authenticateQueueCaller, store: await adminKeyStore(), now: () => new Date() };
}
