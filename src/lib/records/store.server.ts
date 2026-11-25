// Reads and writes precomputed page inputs (`read_records`). Pages read with the shared anonymous SELECT-only client (one query);
// only scheduled jobs write, with the service role loaded inside the call. See records.ts for the age rules.
import { pagedRows } from "../paged";
import { supabaseAnon } from "../mcp/supabase";
import { memo, memoBy } from "../memo";
import { STALE_SERVE_MS, within } from "../deadline";
import { bodyBytes, kindOf, maxAgeOf, needsRetime, usable, type RecordMeta, type RecordRow } from "./records";
import { readerNow } from "../reader-context.server";

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
/** D1 · readers only (readerNow): a stored copy past its age limit is sent at once and rebuilt behind the reader (the rebuild's value
 *  serves the next readers on this server for `ttl`). Jobs never come here: for them a stale copy is always rebuilt (`run`). */
const readerRows = memoBy(60_000, async (key: string) => readRecord<unknown>(key).catch(() => null), { key: (k: string) => k, max: 800 });
/** W3d-c · the stored copy as a reader's page reads it (the same per-instance minute memo; null when unreadable). */
export const readerRecord = (key: string) => readerRows(key);
const rebuilt = new Map<string, { at: number; v: unknown }>();
/** W3d-c · this server forgets every stored copy it holds in memory (a removal: the next read goes to the stored row). */
export function forgetReaderCopies() { readerRows.clear(); rebuilt.clear(); }
async function readerFirst<T>(key: string, decode: (b: never) => T, run: () => Promise<T>, ttl: number): Promise<T> {
  if (!readerNow()) return run();
  const w = rebuilt.get(key);
  if (w && Date.now() - w.at < ttl) return w.v as T;
  const row = await readerRows(key);
  if (!row || usable(row, Date.now(), maxAgeOf(key))) return run();
  void run().then(v => { rebuilt.delete(key); rebuilt.set(key, { at: Date.now(), v }); if (rebuilt.size > 800) { const first = rebuilt.keys().next().value; if (first !== undefined) rebuilt.delete(first); } }, () => undefined);
  return decode(row.body as never);
}
export type Stored<T> = (() => Promise<T>) & { /** The live computation, bypassing the record (the refresher writes this). */ compute: () => Promise<T>; clear: () => void };
/** One shared input: the stored record when it is young enough, else the live computation. Memoised per instance as a second layer. */
export function stored<T, B = T>(key: string, compute: () => Promise<T>, o: { ttl?: number; encode?: (v: T) => B; decode?: (b: B) => T } = {}): Stored<T> & { encode: (v: T) => B } {
  const decode = o.decode ?? ((b: B) => b as unknown as T), encode = o.encode ?? ((v: T) => v as unknown as B);
  const ttl = o.ttl ?? 5 * 60_000;
  // A stale copy is rebuilt (jobs, and readers' background rebuilds); readers are sent the old copy first by readerFirst.
  const m = memo(ttl, async () => {
    const row = await readRecord<B>(key).catch(() => null);
    return row && usable(row, Date.now(), maxAgeOf(key)) ? decode(row.body) : compute();
  });
  const fn = (() => readerFirst(key, (b: B) => decode(b), () => m(), ttl)) as Stored<T> & { encode: (v: T) => B };
  fn.compute = compute; fn.clear = () => m.clear(); fn.encode = encode;
  return fn;
}
/** A keyed record (one per brand, per slug): the record when young enough, else `compute(arg)`. `null` from compute is a real answer. */
export function storedBy<A, T>(keyOf: (a: A) => string, compute: (a: A) => Promise<T>, ttl = 5 * 60_000) {
  const m = memoBy(ttl, async (a: A) => {
    const key = keyOf(a), row = await readRecord<T>(key).catch(() => null);
    return row && usable(row, Date.now(), maxAgeOf(key)) ? row.body : compute(a);
  }, { key: keyOf, max: 400 });
  return Object.assign((a: A) => readerFirst(keyOf(a), (b: T) => b, () => m(a), ttl), { compute, keyOf, clear: () => m.clear() });
}

/** Upsert records with the service role, in batches that stay well under the request size limit. Returns the keys rewritten.
 *  D1 Part 3 · a body whose hash matches the stored one is not rewritten: only its time moves (the age rules read it), so a sweep on a
 *  quiet hour writes a few small rows instead of ~300 page bodies. A stored row with no hash yet is rewritten once, with its hash. */
export async function writeRecords(rows: { key: string; body: unknown; source: string }[]): Promise<string[]> {
  return (await writeRecordsCounted(rows)).written;
}
/** D1b · the same write, also naming the keys whose unchanged body only had its time moved (the sweep's run row counts both).
 *  D1c · an unchanged body's time moves only in the last fifth of its limit (`needsRetime`); before that the check is recorded in
 *  `read_record_checks` instead, one row per key, or one row for a whole per-brand set (`set`: its kind), all in one statement. A changed
 *  body also records `changed_at`, so a re-timed body never looks like a change to what depends on it. */
export async function writeRecordsCounted(rows: { key: string; body: unknown; source: string }[], o: { set?: string } = {}): Promise<{ written: string[]; retimed: string[]; checked: string[] }> {
  if (!rows.length) return { written: [], retimed: [], checked: [] };
  const [{ supabaseAdmin }, { stableHash }] = await Promise.all([import("@/integrations/supabase/client.server"), import("../stable-json")]);
  const t = Date.now(), now = new Date(t).toISOString(), out: string[] = [];
  const hashed = await Promise.all(rows.map(async r => ({ ...r, hash: await stableHash(r.body ?? null) })));
  const have = new Map<string, { hash: string | null; at: string }>(), keys = [...new Set(hashed.map(r => r.key))];
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await supabaseAdmin.from("read_records").select("key,body_hash,computed_at").in("key", keys.slice(i, i + 100));
    if (error) throw new Error("read_records hash read failed");
    for (const r of (data ?? []) as { key: string; body_hash: string | null; computed_at: string }[]) have.set(r.key, { hash: r.body_hash, at: r.computed_at });
  }
  const same = hashed.filter(r => have.get(r.key)?.hash === r.hash), changed = hashed.filter(r => have.get(r.key)?.hash !== r.hash);
  const retime = same.filter(r => needsRetime(r.key, have.get(r.key)?.at, t)), checked = same.filter(r => !needsRetime(r.key, have.get(r.key)?.at, t));
  for (let i = 0; i < retime.length; i += 100) {
    const { error } = await supabaseAdmin.from("read_records").update({ computed_at: now }).in("key", retime.slice(i, i + 100).map(r => r.key));
    if (error) throw new Error("read_records time write failed");
  }
  let batch: { key: string; kind: string; body: never; computed_at: string; changed_at: string; source: string; bytes: number; body_hash: string }[] = [], size = 0;
  const flush = async () => {
    if (!batch.length) return;
    const { error } = await supabaseAdmin.from("read_records").upsert(batch, { onConflict: "key" });
    if (error) throw new Error("read_records write failed");
    out.push(...batch.map(b => b.key)); batch = []; size = 0;
  };
  for (const r of changed) {
    const bytes = bodyBytes(r.body);
    if (size + bytes > 1_500_000) await flush();
    batch.push({ key: r.key, kind: kindOf(r.key), body: (r.body ?? null) as never, computed_at: now, changed_at: now, source: r.source.slice(0, 60), bytes, body_hash: r.hash }); size += bytes;
  }
  await flush();
  const source = rows[0]!.source.slice(0, 60);
  const marks = o.set ? [{ key: o.set, checked_at: now, source }] : checked.map(r => ({ key: r.key, checked_at: now, source }));
  if (marks.length) {
    const { error } = await supabaseAdmin.from("read_record_checks").upsert(marks, { onConflict: "key" });
    if (error) throw new Error("read_record_checks write failed");
  }
  return { written: out, retimed: retime.map(r => r.key), checked: checked.map(r => r.key) };
}
/** D1c · when the sweep last found each record (or per-brand set) unchanged. Service role (the table is private). */
export async function recordChecks(): Promise<Map<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out = new Map<string, string>();
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await supabaseAdmin.from("read_record_checks").select("key,checked_at").order("key").range(from, from + 999);
    if (error) throw new Error("read_record_checks read failed");
    for (const r of data ?? []) out.set(r.key, r.checked_at);
    if (!data || data.length < 1000) break;
  }
  return out;
}
/** D1c · the newest real change of one record's body (null before D1c or when missing): cards are dirtied by a changed signals record,
 *  not by its re-timing. */
export async function changedAt(key: string): Promise<string | null> {
  const { data, error } = await supabaseAnon().from("read_records").select("changed_at").eq("key", key).maybeSingle();
  if (error) throw error;
  return (data as { changed_at: string | null } | null)?.changed_at ?? null;
}
/** D1c · the brands still tracked (health leaves stored rows of other brands out of its ages). */
export async function trackedDomains(): Promise<Set<string>> {
  const { data, error } = await pagedRows((f, t) => supabaseAnon().from("library_sites").select("domain").eq("active", true).order("domain").range(f, t));
  if (error) throw error;
  return new Set((data ?? []).map(r => String(r.domain).toLowerCase()));
}
/** W3d-c · the studies' copies written by another build that the sweep rebuilds first (records.ts `copiesOfOldBuild`): two small JSON
 *  fields per row, no bodies. Jobs only. */
export async function oldBuildCopies(build: string): Promise<string[]> {
  const { copiesOfOldBuild } = await import("./records");
  const { data, error } = await supabaseAnon().from("read_records").select("key,k:body->>kind,b:body->>build").in("kind", ["data-story", "data-index"]).limit(500);
  if (error) throw error;
  return copiesOfOldBuild((data ?? []) as { key: string; k: string | null; b: string | null }[], build);
}
