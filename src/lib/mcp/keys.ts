// Owner-issued MCP keys: format, generation, header parsing and per-key limits. Pure (crypto via Web Crypto only).
import { z } from "zod";
export const KEY_PREFIX = "dsgn_";
export const KEY_RE = /^dsgn_[A-Za-z0-9]{32}$/;
export const DEFAULT_KEY_RATE = 600;
const B62 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
/** `dsgn_` + 32 base62 chars (~190 bits), unbiased via rejection sampling. */
export function generateKey(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < 32) for (const b of random(48)) { if (b < 248 && out.length < 32) out += B62[b % 62]; }
  return KEY_PREFIX + out;
}
export const keyPrefix = (key: string) => key.slice(0, 8);
export async function keyHash(key: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
/** No header → anonymous. Anything else must be `Bearer dsgn_…` in the right shape, or it is rejected (no detail). */
export function parseAuthorization(header: string | null): { kind: "none" } | { kind: "key"; key: string } | { kind: "invalid" } {
  if (header === null || header.trim() === "") return { kind: "none" };
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m && KEY_RE.test(m[1]!) ? { kind: "key", key: m[1]! } : { kind: "invalid" };
}
/** Fixed-window limiter whose limit is chosen per call (each key carries its own rate); bounded to 10k tracked keys. */
export function createKeyedLimiter(windowMs = 60000) {
  const buckets = new Map<string, { started: number; count: number }>();
  return (id: string, limit: number, now = Date.now()) => {
    for (const [k, b] of buckets) if (now - b.started >= windowMs) buckets.delete(k);
    const b = buckets.get(id);
    if (!b) { if (buckets.size >= 10000) return false; buckets.set(id, { started: now, count: 1 }); return true; }
    if (b.count >= limit) return false; b.count++; return true;
  };
}
const METHODS = new Set(["initialize", "ping", "tools/list", "resources/list", "resources/read", "prompts/list", "notifications/initialized"]);
/** Usage rows are aggregate and bounded: known tool names, known protocol methods, else "other". */
export function usageTool(method: unknown, toolName: unknown, known: ReadonlySet<string>, httpMethod: string): string {
  if (method === "tools/call") return typeof toolName === "string" && known.has(toolName) ? toolName : "other";
  if (typeof method === "string") return METHODS.has(method) ? method : "other";
  return httpMethod === "GET" ? "http_get" : httpMethod === "DELETE" ? "http_delete" : "other";
}
export const adminBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().trim().min(1).max(80), rate_per_min: z.number().int().min(1).max(6000).optional(), note: z.string().max(300).optional() }).strict(),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("list") }).strict(),
]);
export const ADMIN_BODY_LIMIT = 4096;
