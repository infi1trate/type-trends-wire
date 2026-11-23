// Reads and writes precomputed page inputs (`read_records`). Pages read with the shared anonymous SELECT-only client (one query);
// only scheduled jobs write, with the service role loaded inside the call. See records.ts for the age rules.
import { supabaseAnon } from "../mcp/supabase";
import { memo, memoBy } from "../memo";
import { STALE_SERVE_MS, within } from "../deadline";
import { bodyBytes, kindOf, maxAgeOf, usable, type RecordMeta, type RecordRow } from "./records";

export async function readRecord<T>(key: string): Promise<RecordRow<T> | null> {
  const { data, error } = await supabaseAnon().from("read_records").select("key,body,computed_at").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data as RecordRow<T> | null) ?? null;
}
export async function readRecords<T>(keys: string[]): Promise<Map<string, RecordRow<T>>> {
  if (!keys.length) return new Map();
  const { data, error } = await supabaseAnon().from("read_records").select("key,body,computed_at").in("key", keys);
  if (error) throw error;
  return new Map(((data ?? []) as RecordRow<T>[]).map(r => [r.key, r]));
}
/** Every record's key, kind and age, without bodies (the sweeper and /status). */
export async function recordMetas(): Promise<RecordMeta[]> {
  const out: RecordMeta[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabaseAnon().from("read_records").select("key,kind,computed_at").order("key").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as RecordMeta[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** A stored copy past its age limit is rebuilt live, but only if the rebuild finishes within STALE_SERVE_MS (or fails): otherwise the
 *  old copy is served (any age), so a sweep that fell behind after an outage turns into an older page, never a failed one. */
export function liveOrOld<T>(compute: () => Promise<T>, old: () => T, what: string, ms = STALE_SERVE_MS): Promise<T> {
  return within(compute(), ms, what, old).catch(() => old());
}
export type Stored<T> = (() => Promise<T>) & { /** The live computation, bypassing the record (the refresher writes this). */ compute: () => Promise<T>; clear: () => void };
/** One shared input: the stored record when it is young enough, else the live computation. Memoised per instance as a second layer. */
export function stored<T, B = T>(key: string, compute: () => Promise<T>, o: { ttl?: number; encode?: (v: T) => B; decode?: (b: B) => T } = {}): Stored<T> & { encode: (v: T) => B } {
  const decode = o.decode ?? ((b: B) => b as unknown as T), encode = o.encode ?? ((v: T) => v as unknown as B);
  const m = memo(o.ttl ?? 5 * 60_000, async () => {
    const row = await readRecord<B>(key).catch(() => null);
    return row && usable(row, Date.now(), maxAgeOf(key)) ? decode(row.body) : row ? liveOrOld(compute, () => decode(row.body), key) : compute();
  });
  const fn = (() => m()) as Stored<T> & { encode: (v: T) => B };
  fn.compute = compute; fn.clear = () => m.clear(); fn.encode = encode;
  return fn;
}
/** A keyed record (one per brand, per slug): the record when young enough, else `compute(arg)`. `null` from compute is a real answer. */
export function storedBy<A, T>(keyOf: (a: A) => string, compute: (a: A) => Promise<T>, ttl = 5 * 60_000) {
  const m = memoBy(ttl, async (a: A) => {
    const key = keyOf(a), row = await readRecord<T>(key).catch(() => null);
    return row && usable(row, Date.now(), maxAgeOf(key)) ? row.body : row ? liveOrOld(() => compute(a), () => row.body, key) : compute(a);
  }, { key: keyOf, max: 400 });
  return Object.assign((a: A) => m(a), { compute, keyOf });
}

/** Upsert records with the service role, in batches that stay well under the request size limit. Returns the keys written. */
export async function writeRecords(rows: { key: string; body: unknown; source: string }[]): Promise<string[]> {
  if (!rows.length) return [];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString(), out: string[] = [];
  let batch: { key: string; kind: string; body: never; computed_at: string; source: string; bytes: number }[] = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabaseAdmin.from("read_records").upsert(batch, { onConflict: "key" });
    if (error) throw new Error("read_records write failed");
    out.push(...batch.map(b => b.key)); batch = []; size = 0;
  };
  for (const r of rows) {
    const bytes = bodyBytes(r.body);
    if (size + bytes > 1_500_000) await flush();
    batch.push({ key: r.key, kind: kindOf(r.key), body: (r.body ?? null) as never, computed_at: now, source: r.source.slice(0, 60), bytes }); size += bytes;
  }
  await flush();
  return out;
}
