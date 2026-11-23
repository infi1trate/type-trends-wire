// C1b · plain database reads for the paths a cold instance answers before any page code loads (pictures, a page's announced picture):
// the same address, keys and headers as the generated clients, without loading a database library. Reads only; never logs a key.
const env = (names: string[]) => { for (const n of names) { const v = process.env[n]?.trim(); if (v) return v; } return undefined; };
function publishableKey(): string | undefined {
  let key = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"]);
  if (!key) {
    try {
      const keys: unknown = JSON.parse(process.env["SUPABASE_PUBLISHABLE_KEYS"] ?? "{}");
      if (keys && typeof keys === "object" && !Array.isArray(keys)) { const values = keys as Record<string, unknown>; key = [values["default"], ...Object.values(values)].find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))?.trim(); }
    } catch { /* a legacy key may still be set */ }
  }
  return key ?? env(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
}
/** The headers the generated clients send: the key as `apikey`, and as a bearer only when it is a legacy JWT (new keys are opaque). */
export const authHeaders = (key: string): Record<string, string> => (key.startsWith("sb_") ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` });
export type Who = "public" | "service";
function config(who: Who): { url: string; key: string } {
  const url = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]), key = who === "public" ? publishableKey() : env(["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!url || !key) throw new Error("Database configuration missing");
  return { url, key };
}
/** GET /rest/v1/<table>?<query> as the public reader (RLS applies) or the service; rows, or an error on any failure. */
export async function restRows(who: Who, table: string, query: string): Promise<Record<string, unknown>[]> {
  const { url, key } = config(who);
  const r = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: { ...authHeaders(key), Accept: "application/json" } });
  if (!r.ok) { await r.body?.cancel(); throw new Error(`Read failed (${r.status})`); }
  return (await r.json()) as Record<string, unknown>[];
}
/** One stored object's bytes (service), or null when it is missing. */
export async function storageBytes(bucket: string, path: string): Promise<Uint8Array | null> {
  const { url, key } = config("service");
  const r = await fetch(`${url}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, { headers: authHeaders(key) });
  if (!r.ok) { await r.body?.cancel(); return null; }
  return new Uint8Array(await r.arrayBuffer());
}
